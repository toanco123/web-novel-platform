# Plan: Giọng AI cho tính năng nghe truyện

Trạng thái: 🚧 đang làm. Nhánh `ai-voices`.

Tiến độ (07/10/2026):
- [x] Lõi `session.ts` + `deviceEngine.ts` (không đổi hành vi)
- [x] Migration `tts_ai_voices` (đã push), ca kiểm tra, sinh lại kiểu, `thiet-ke-database.md`
- [x] Hàm Vercel `api/tts` + test
- [x] Web: Giọng AI (`features/tts`, `clipQueue`, `cloudEngine`), cài đặt, gợi ý cài giọng, toast, CSP, proxy dev
- [x] Admin: ô "Giọng AI tháng này"
- [ ] Tài khoản Google Cloud, Cloudflare R2, biến môi trường Vercel (người dùng làm); nghe thử và chốt 4 giọng
- [ ] Thử thật trên bản preview (Chrome, Safari, iPhone)
- [ ] App di động

Khác với plan:
- CSP `media-src` cho mọi `https:` thay vì viết cứng tên miền R2 (tên miền chưa có; file âm thanh không chạy được mã).
- Server bỏ qua các đoạn nằm ngoài chương trong `generate` thay vì báo lỗi (tạo sẵn chương sau khi chưa biết số đoạn).

## Context

Nghe truyện hiện chỉ dùng giọng có sẵn trên máy: web dùng Web Speech API (`web-novel-platform/src/features/reader/speech/`), app dùng `expo-speech` (`mobile-novel-platform/src/features/reader/speech/`). Ô chọn giọng đã có, nhưng Android/Chrome thường chỉ có 1 giọng Google tiếng Việt, iPhone chỉ có "Linh", nên user gần như không có gì để chọn. Mục tiêu là cho user chọn được giọng AI tự nhiên mà **không tốn tiền**: dùng hạn mức miễn phí của Google và lưu file để mỗi đoạn văn chỉ phải tạo một lần.

Plan này làm thẳng, không viết thêm `trien-khai-*.md`.

## Đã chốt (07/10/2026)

- **Cách tạo:** tạo theo yêu cầu (hướng A). Khi user bấm nghe, server tạo âm thanh cho đoạn chưa có, lưu lại, người sau nghe lại file đã lưu.
- **Ai dùng:** chỉ người đã đăng nhập. Khách vẫn thấy nhóm "Giọng AI" nhưng bị khóa, kèm link "Đăng nhập để dùng".
- **Nhà cung cấp:** Google Cloud TTS, loại **Chirp 3 HD** (có vi-VN; miễn phí 1 triệu ký tự mỗi tháng, vượt thì 30 USD / 1 triệu). **4 giọng (2 nữ, 2 nam)**, chọn sau buổi nghe thử. Xác thực bằng API key chỉ mở cho Text-to-Speech API.
- **Lưu file:** **Cloudflare R2** (10GB miễn phí, băng thông tải về miễn phí), đọc công khai qua tên miền riêng.
- **Giới hạn:**
  - Mỗi người được tạo mới khoảng 30.000 ký tự mỗi ngày (khoảng 2 chương). Nghe lại phần đã có sẵn không tính.
  - Cả hệ thống tối đa 900.000 ký tự mỗi tháng (90% hạn mức miễn phí, cấu hình bằng biến môi trường).
  - Hết hạn mức thì chỉ nghe được những đoạn đã có sẵn.
- **Khi lỗi giữa chương** (hết hạn mức, hết lượt trong ngày, mất mạng, chương đã bị sửa): tự chuyển sang giọng của máy từ đúng đoạn đang đọc, kèm toast báo lý do.
- **Làm thêm trong đợt này:**
  - Gợi ý cách cài giọng máy hay hơn.
  - App: nghe tiếp khi khóa màn hình.
  - Admin: ô xem hạn mức đã dùng.

**Ngoài phạm vi:**
- Dọn file cũ khi tác giả sửa hoặc xóa chương.
- Giọng AI cho chương đã tải về để đọc offline.
- Nút điều khiển trên màn hình khóa.
- Admin tạo sẵn âm thanh hàng loạt (hướng B).

## 1. Kiến trúc

```
Client (web/app) ──POST /api/tts {slug, chapter, voice, total, generate[], title}──► Vercel api/tts.ts
                                                                                  │ kiểm tra JWT, tải chương công khai (anon)
                                                                                  │ tách đoạn (richText htmlparser2) → hash
                                                                                  │ tts_lookup (đã có?) → tts_reserve (trừ hạn mức)
                                                                                  │ Google synthesize → R2 PUT → tts_commit
◄── { total, title?: string[], paragraphs: (string[] | null)[] }  (URL R2 của từng phần)
Client phát URL bằng <audio> / expo-audio, tốc độ đọc chỉnh bằng playbackRate
```

- **Đơn vị lưu:** mỗi đoạn được cắt thành các phần ≤ 1.400 byte (giới hạn của Google là 5.000 byte; tiếng Việt tốn 2–3 byte mỗi chữ). Mỗi phần là một file MP3 riêng, khóa `tts/v1/{voice}/{sha256}.mp3`. Không ghép các MP3 lại với nhau. Khóa theo nội dung nên đoạn giống nhau dùng chung file, và chương bị sửa chỉ phải tạo lại những đoạn đã đổi.
- **Manifest:** mỗi request trả URL của mọi đoạn đã có (`null` cho đoạn chưa có) và tạo tối đa 4 đoạn trong `generate`. Chương đã có đủ âm thanh chỉ tốn 1 request. Client đọc trước 3 đoạn, và tạo sẵn 2 đoạn đầu của chương sau khi còn 3 đoạn nữa là hết chương (nếu bật tự chuyển chương).
- **Chống lạm dụng:** server tự tải nội dung chương công khai, không nhận chữ từ client, nên không ai dùng được API này để đọc văn bản tùy ý. Hạn mức được trừ trước khi gọi Google, gọi lỗi thì hoàn lại.
- **Tốc độ đọc:** file luôn tạo ở tốc độ 1.0, client chỉnh tốc độ khi phát nên một file dùng được cho mọi tốc độ.
- **Đoạn không có chữ** (`***`, `—`): trả `[]`, client bỏ qua.

## 2. Web: server (`api/`)

- `api/tts.ts`: hàm `POST` mỏng, gọi `handleTts(request, deps)` theo kiểu truyền phụ thuộc như `meta.ts`/`page.ts`, trả `cache-control: no-store`.
- `api/_lib/tts.ts`: kiểm tra input (danh sách giọng cho phép, `generate` ≤ 4 và trong khoảng), chạy song song kiểm tra user (`/auth/v1/user`, từ chối tài khoản bị khóa) và tải chương, rồi lookup → reserve → synthesize (3 luồng) → upload → commit. Mã lỗi:

  | Mã HTTP | Ý nghĩa |
  |---|---|
  | 401 | Chưa đăng nhập |
  | 400 | Input không hợp lệ |
  | 404 | Chương không công khai |
  | 429 | `tts_daily_quota` / `tts_month_quota` |
  | 503 | `tts_unavailable` (kể cả khi thiếu biến môi trường) |

- `api/_lib/ttsText.ts`: `ttsParts(text)` dùng lại `splitForSpeech` (`src/features/reader/speech/splitForSpeech.ts`, import tương đối có đuôi `.js`), gom thành các phần ≤ 1.400 byte. `clipKey(voice, text)` tạo khóa file, `countChars` đếm ký tự.
- `api/_lib/richText.ts`: chép bản htmlparser2 từ `mobile-novel-platform/src/features/chapters/richText.ts`, kèm test của web chạy nguyên văn để bảo đảm cách đánh số đoạn giống hệt client. Thêm `htmlparser2` và `domhandler` vào dependencies của web.
- `api/_lib/google.ts`: `synthesize(text, voice, key)` gọi `text:synthesize` với giọng `vi-VN-Chirp3-HD-{id}`, định dạng MP3, timeout 15 giây.
- `api/_lib/r2.ts`: `putClip` dùng `aws4fetch` (S3 SigV4), header `cache-control: public, max-age=31536000, immutable`. `publicUrl(key)` tạo URL công khai.
- `api/_lib/data.ts`: thêm `serviceConfig()` (đọc `SUPABASE_SERVICE_ROLE_KEY`), `rpc()`, `fetchUser()`, `publicChapter(slug, n)`. Dùng lại `rest()` sẵn có.
- **Biến môi trường** (Vercel và `.env.example`):
  - Google: `GOOGLE_TTS_API_KEY`
  - R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `TTS_PUBLIC_BASE_URL`
  - Hạn mức: `TTS_MONTH_CHAR_CAP=900000`, `TTS_USER_DAY_CHAR_CAP=30000`
  - Supabase: `SUPABASE_SERVICE_ROLE_KEY`
- **Chạy local:** `npm run dev` không phục vụ `/api`, nên thêm `server.proxy['/api/tts']` trỏ tới bản preview trên Vercel qua biến `TTS_DEV_PROXY`.

## 3. Web: client

- `src/lib/ttsVoices.ts` (không import gì, để api dùng chung được): `TTS_VOICES` gồm 4 giọng `{id, label, gender}`, `isTtsVoice`, `googleVoiceName`.
- `src/features/tts/`: gồm `shared.ts` (`TtsError` với các mã, kiểu `TtsManifest`), `api.ts`, `api.remote.ts` (lấy token từ `getSession`, đổi mã HTTP thành `TtsError`), `api.mock.ts` (trả clip im lặng dạng `data:audio/mpeg`, hạn mức giữ trong bộ nhớ để test ép lỗi được), `endpoint.ts`.
- **Lõi phát chung** `speech/session.ts`: TS thuần, không phụ thuộc framework, gom vòng lặp đoạn / run-id / tự chuyển chương / chuyển sang giọng máy khi lỗi mà hiện nay đang viết lặp ở cả `useChapterSpeech.ts` (web) và `speechPlayer.ts` (app). App chép nguyên file này kèm test.
  - Engine có các hàm `prime`, `speak(job, signal)`, `pause`, `resume`, `setRate`, `cancel`, `prepare`.
  - `deviceEngine.ts`: chuyển nguyên vòng utterance hiện tại sang, giữ cách tạm dừng hiện tại (dừng hẳn rồi đọc lại đoạn).
  - `cloudEngine.ts`: một phần tử `<audio>` dùng chung cho mọi clip, cộng một phần tử thứ hai để tải trước. Tạm dừng và tiếp tục giữ đúng vị trí. Tốc độ chỉnh trực tiếp bằng `playbackRate`. `prime()` phát một clip im lặng ngay trong lúc user bấm, để mở khóa phát tự động trên iOS Safari.
  - `clipQueue.ts`: cache manifest theo chương, cửa sổ đọc trước, chống gửi trùng request.
  - Lỗi `TtsError` → bật cờ `aiOff` cho phiên nghe, gọi `onFallback` một lần (toast `sonner`), giọng máy đọc tiếp từ đúng đoạn đó. Nếu `total` của server khác client thì báo lỗi `content_changed`, cũng chuyển sang giọng máy.
- `useChapterSpeech.ts`: chỉ còn là hook mỏng bọc session. API trả cho `ChapterReaderPage` giữ nguyên.
- `useSpeechSettings.ts`: thêm `aiVoice: string | null` (`null` là dùng giọng máy), giữ `version: 1` vì persist tự gộp key mới.
- `ReaderSettingsPanel.tsx`:
  - Select có 2 nhóm: "Giọng AI" (khách bị khóa, kèm link `paths.login(next)`) và "Giọng của máy".
  - Gợi ý cài giọng (thu gọn được) lấy từ `voiceTips(userAgent)` (`speech/voiceTips.ts`): Edge có HoaiMy/NamMinh Online (Natural); iPhone vào Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt → Linh (Nâng cao); Android tải gói giọng của Google/Samsung.
- `src/lib/errorFilter.ts`: thêm `'TtsError'` vào `EXPECTED_ERRORS`.
- `vercel.json`: thêm `media-src 'self' data: blob: https://<tên miền R2>` (hiện chưa có `media-src` nên đang theo `default-src 'self'`), kèm test trong `src/app/securityHeaders.test.ts`.

## 4. Web: admin

- `features/admin/{shared,api,api.remote,api.mock,hooks}.ts`: thêm `getAdminTtsUsage` và `useAdminTtsUsage`.
- `features/admin/components/TtsUsageCard.tsx`: `Card` + `Progress` của antd (đã dùng / mức chặn, đổi màu khi ≥ 80%), số đoạn đã lưu, và `Sparkline` ký tự theo ngày. Đặt trong `src/pages/admin/AdminDashboardPage.tsx`.

## 5. Database (migration `tts_ai_voices`, làm theo skill `db-migration`)

- **Bảng** trong `private`, bật RLS, thu hồi mọi quyền của `anon` và `authenticated`:
  - `tts_clips(voice, text_hash, chars, bytes, created_by, created_at, pk(voice, text_hash))`
  - `tts_usage_month(month pk, chars, cap)`
  - `tts_usage_day(user_id, day, chars, pk(user_id, day))`
  - Ngày và tháng tính theo `Asia/Ho_Chi_Minh` (như `admin_overview`).
- **Hàm cho server**, chỉ cấp cho `service_role`:
  - `tts_lookup(voice, hashes[])`: trả các hash đã có file.
  - `tts_reserve(user, chars, month_cap, day_cap)`: trừ hạn mức nguyên tử; vượt thì ném `tts_daily_quota` / `tts_month_quota` (P0001) và không trừ gì.
  - `tts_commit(user, voice, clips jsonb, refund)`: `on conflict do nothing`, hoàn lại phần lỗi.
- **Hàm cho admin:** `admin_tts_usage()` qua `require_admin()`, trả `{month, chars, cap, clips, clipsThisMonth, users, days[]}`.
- Ca kiểm tra trong `supabase/checks/rls_and_rules.sql`; sinh lại `src/types/database.ts`; cập nhật `documents/thiet-ke-database.md`.

## 6. App di động

- **Chép nguyên văn, ghi nguồn ở dòng đầu:** `speech/session.ts`, `clipQueue.ts`, `voiceTips.ts` (kèm test), `features/tts/shared.ts`, `features/tts/api.ts` (lấy từ `api.remote.ts` của web), `lib/ttsVoices.ts`, `lib/errorFilter.ts`.
- **Viết riêng cho app:**
  - `features/tts/endpoint.ts` (`${SITE_URL}/api/tts`).
  - `speech/deviceEngine.ts` (expo-speech).
  - `speech/cloudEngine.ts` (expo-audio, `setPlaybackRate`).
  - `speechPlayer.ts` chỉ còn bọc session; giữ `claimSpeech`, `releaseSpeech`, `setSpeechAdvance`.
- `useSpeechSettings.ts`: thêm `aiVoice`. `ReaderSettingsPanel.tsx`: thêm danh sách "Giọng AI" (khách bấm thì mở `/login`) và gợi ý cài giọng.
- **Nghe khi khóa màn hình:** chạy `npx expo install expo-audio`, thêm plugin expo-audio vào `app.json` (bật phát nền, tắt quyền micro; kiểm tra tên option theo tài liệu SDK 57), bật audio mode phát nền. Cần build bản dev bằng EAS, Expo Go không thử được.
- Cập nhật `documents/dong-bo-web.md` và bảng file trong skill `sync-from-web`.

## 7. Các bước

1. **Bạn chuẩn bị:**
   - Google Cloud: tạo project, bật Text-to-Speech API, bật billing, tạo API key chỉ cho TTS.
   - Cloudflare: tạo bucket R2, gắn tên miền riêng, tạo access key.
   - Khai báo biến môi trường trên Vercel.
   - Mình làm một script nghe thử để bạn chọn 4 giọng.
2. Migration và ca kiểm tra SQL (chạy thử trong transaction, dry-run, rồi push sau khi bạn đồng ý), sinh lại kiểu, cập nhật tài liệu DB.
3. `api/_lib` và `api/tts.ts` kèm test, deploy bản preview, thử bằng curl.
4. Tách code nghe truyện của web thành `session.ts` + `deviceEngine.ts`, **không đổi hành vi**: test nghe truyện hiện có phải qua. Commit riêng.
5. Phần client: giọng AI, cloud engine, giao diện cài đặt, gợi ý cài giọng, toast, CSP, proxy khi chạy local.
6. Ô hạn mức ở trang admin.
7. Tài liệu: `plan-giong-ai.md`, `CLAUDE.md` (mục Nghe truyện), `.env.example`.
8. App: đồng bộ file, expo-audio, cloud engine, giao diện cài đặt, `app.json`, build bản dev.

Mỗi commit tăng version theo quy ước của từng repo.

## 8. Kiểm tra

- **api** (`npx vitest run api`):
  - Test richText giống bản web.
  - Giới hạn byte của mỗi phần, khóa file ổn định, bỏ đoạn không có chữ.
  - `handleTts` với phụ thuộc giả: 401 / 400 / 404; đã có đủ thì không gọi reserve và Google; còn thiếu thì reserve đúng số ký tự, upload đúng khóa rồi commit; lỗi hạn mức thành 429; Google lỗi thì hoàn hạn mức.
- **SQL:**
  - `anon` và `authenticated` bị chặn (`42501`).
  - Vượt hạn mức ngày / tháng thì ném đúng mã và không trừ gì.
  - Commit chạy lại nhiều lần không sai, hoàn lại không bao giờ âm.
  - Admin và không phải admin.
- **Web unit:**
  - `session.test.ts` với engine giả: thứ tự đọc, tiêu đề, tạm dừng, nhảy đoạn, đổi tốc độ, tự chuyển chương, lỗi ở đoạn k thì giọng máy đọc tiếp từ k và toast hiện một lần, lượt phát cũ bị bỏ qua.
  - `clipQueue.test.ts`, test của `features/tts/api`.
- **Web tích hợp** (skill `integration-test`):
  - Khách thấy nhóm Giọng AI bị khóa.
  - Đăng nhập chọn giọng AI thì đoạn đang đọc được tô sáng và chuyển đoạn khi `ended`.
  - Ép hết hạn mức thì hiện toast và `speechSynthesis.speak` đọc đúng đoạn đó.
  - Ô TTS ở admin, CSP có `media-src`.
- **Toàn bộ web:** `npm run typecheck && npm run lint && npm test && npm run build`.
- **Thử thật:** trên bản preview, nghe một chương bằng Chrome và Safari (kể cả iPhone), xem file xuất hiện trong R2 và số ký tự tăng ở admin; nghe lại thì không tăng thêm.
- **App:** `npm run typecheck`, `lint`, `test`. Chỉ mở simulator khi bạn yêu cầu. Thử khóa màn hình trên máy thật với bản build dev.

## 9. Rủi ro

- **iOS Safari chặn phát tự động:** xử lý bằng `prime()` trong lúc bấm, dùng lại một phần tử `<audio>`, và chuyển đoạn dựa vào sự kiện `ended` thay vì timer.
- **App khóa màn hình mà clip sau chưa tải xong** thì phiên âm thanh dừng: giữ cửa sổ đọc trước 3 đoạn và tạo sẵn chương sau.
- **Hai người cùng tạo một đoạn:** PUT lên R2 ghi đè cùng nội dung, commit bỏ qua trùng, chỉ tốn vài ký tự thừa.
- **Hạn mức:** đã trừ trước khi tạo nên không vượt được mức chặn. Nhiều tài khoản spam vẫn bị chặn bởi mức tháng.
- **Chi tiết nhà cung cấp còn phải xem lại tài liệu trước khi làm:** Chirp 3 HD nhận văn bản thuần, tên option expo-audio SDK 57 (bước 3 và bước 8).
