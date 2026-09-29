# Plan: PWA và đọc offline

## Context
Người đọc hay đọc trên điện thoại, lúc mạng yếu hoặc mất mạng (xe buýt, tàu, thang máy) thì trang đọc không tải được. Mục tiêu: cài web lên màn hình chính như ứng dụng, và vẫn đọc tiếp được khi offline.

Đã chốt với người dùng (29/09/2026):
- **Tự động:** lưu mọi chương đã mở, và khi có mạng thì tự tải trước **5 chương kế tiếp** của truyện đang đọc.
- **Chủ động:** nút **"Tải về đọc offline"** (20 / 50 / toàn bộ chương còn lại); chương tải chủ động được ghim, không bị tự xóa.
- **Lịch sử đọc khi offline:** lưu tạm trên máy, có mạng thì đồng bộ lên server.
- Cách làm: service worker (`vite-plugin-pwa`) chỉ lo file tĩnh; dữ liệu chương lưu **IndexedDB** do code app quản lý (không cache response Supabase trong service worker, không persist cả cache TanStack Query).

**Trạng thái:** ✅ Xong (29/09/2026).

---

## 1. Cài ứng dụng và khung app offline
- Thêm `vite-plugin-pwa` (chế độ `generateSW`, Workbox).
- **Manifest:** `name`/`short_name` từ `SITE_NAME`, `display: standalone`, `start_url: /`, `background_color`/`theme_color` lấy màu nền theme tối (`#1a0f1d`). Icon PNG 64, 192, 512 và 512 maskable, `apple-touch-icon` 180, `favicon.ico`, sinh từ `public/favicon.svg` (bằng `@vite-pwa/assets-generator`, dev dependency, lệnh `npm run generate-pwa-assets`; file PNG được commit). `favicon.svg` hiện là logo mặc định của Vite nên được thay bằng icon riêng của web (sách mở màu vàng hồng, dải đánh dấu hồng neon trên nền tím mận). `index.html` thêm `theme-color` và `apple-touch-icon`.
- **Precache:** `index.html`, CSS, JS của layout, trang đọc, tủ truyện, trang chi tiết truyện và các trang thường; font chỉ bộ `latin`, `latin-ext` và `vietnamese` (bỏ `cyrillic`, `greek`). Phải giữ `latin-ext`: bộ này khai báo sau `vietnamese` và cũng chứa Đ, Ă, Ơ, Ư, Ĩ, Ũ, ỹ..., mà khi `unicode-range` chồng nhau trình duyệt lấy chữ từ bộ khai báo sau (test trong `pwa.config.test.ts` giữ quy tắc này). **Không** precache chunk khu quản trị (antd, `@ant-design/plots`) và Sáng tác (Tiptap): các khu này chỉ dùng khi có mạng. Nếu tên chunk không đủ ổn định để lọc bằng `globIgnores` thì đặt tên chunk qua cấu hình build.
- **Điều hướng offline:** `navigateFallback: /index.html`, mở thẳng link chương khi offline vẫn vào app.
- **Lỗi mở trang:** các route gốc có `ErrorBoundary` chung (`RouteError`): không tải được file JS của trang (mở khu Sáng tác/Quản trị lúc offline, hoặc web vừa lên bản mới) thì hiện "Bạn đang offline, trang này cần có mạng" (kèm link truyện đã lưu) hoặc "Không mở được trang này" + "Tải lại trang", thay cho màn hình lỗi mặc định của React Router.
- **Ảnh bìa (Supabase Storage):** runtime cache `CacheFirst` cho `/storage/v1/object/public/`, tối đa 200 ảnh, 30 ngày, nhận cả response opaque (`statuses: [0, 200]`). Request tới REST/Auth của Supabase **không** qua cache service worker.
- `StoryCover`: ảnh lỗi (offline, chưa cache) thì chuyển sang bìa chữ tự sinh (`onError`).
- **Cập nhật phiên bản:** `registerType: 'prompt'`, không tự tải lại trang (tránh mất chỗ đang đọc). Có bản mới thì hiện thông báo nổi "Có phiên bản mới" + nút "Cập nhật"; không bấm thì lần mở app sau dùng bản mới. Phần đăng ký service worker và thông báo này nằm ở `src/app/pwa.tsx`, gắn trong `main.tsx` (ngoài `Providers`) để test không đụng tới module ảo `virtual:pwa-register`.
- **Nút "Cài ứng dụng":** trong menu người dùng và footer, chỉ hiện khi trình duyệt phát `beforeinstallprompt` (Android/Chrome) và app chưa chạy ở chế độ standalone. iOS không có nút (người đọc tự "Thêm vào màn hình chính").
- `vercel.json`: `/sw.js` và `/manifest.webmanifest` trả `Cache-Control: no-cache` để bản mới được nhận ngay.
- Dev server và Vitest: service worker tắt (`devOptions.enabled: false`).

## 2. Kho chương trên máy (`src/features/offline/`)
- IndexedDB qua thư viện `idb`. Database `offline-reading`, khóa `${slug}#${number}`, hai store:
  - `chapters`: thông tin chương `{ id, slug, number, meta: ChapterContent trừ content, bytes, pinned: 0 | 1, savedAt, readAt, usedAt, progress }`, index `bySlug` và `byUse` (`[pinned, usedAt]`, để dọn kho chỉ đọc khóa, không nạp nội dung);
  - `contents`: nội dung chương. Liệt kê/dọn kho chỉ đọc store `chapters` (nhỏ), kể cả khi đã tải về hàng nghìn chương.
- `ChapterContent.story` thêm `coverUrl: string | null` (bản mock và remote) để tab "Đã lưu" có bìa.
- Kho dùng chung cho cả máy, **không** tách theo tài khoản (nội dung chương công khai, như cache trình duyệt). Đăng xuất không xóa; có nút "Xóa tất cả".
- Chỉ lưu chương của truyện **công khai** (`ChapterContent.story.visibility`): chủ truyện xem truyện chưa công khai thì không lưu, không tải trước và không có nút tải về, để người khác dùng chung máy không đọc được.
- Hàm của kho (`store.ts`): lấy một chương, lưu nhiều chương (`pinned` hay không), ghi `readAt`/`progress`, số chương đã lưu của một truyện, danh sách truyện đã lưu, xóa một truyện, xóa tất cả, tổng dung lượng.
- Hook TanStack Query cho UI (`hooks.ts`), key bắt đầu bằng `['offline']`; ghi vào kho thì invalidate key này.
- Không có IndexedDB (trình duyệt chặn, chế độ riêng tư, `indexedDB.open` ném lỗi) hoặc mở kho quá 3 giây (lỗi WebKit treo khi mở) thì mọi hàm của kho không làm gì và app chạy như hiện nay.

## 3. Đọc một chương (`useChapter`)
`queryFn` mới, `networkMode: 'always'` (mặc định TanStack Query dừng query khi offline, trang đọc sẽ kẹt ở khung loading):
1. **Có bản lưu:** trả ngay. Đồng thời tải bản mới ở nền bằng `getChapter`:
   - khác bản lưu (tác giả sửa chương, có chương sau mới, số chương thay đổi) thì ghi kho + `setQueryData`;
   - server trả `null` thì `setQueryData(null)` → trang hiện 404, rồi dọn kho: truyện không còn (bị gỡ, bị ẩn) thì xóa mọi chương đã lưu của truyện, chỉ chương bị ẩn thì xóa chương đó;
   - truyện nay không còn công khai (chủ truyện ẩn đi) thì chủ truyện vẫn đọc bản mới, còn mọi chương đã lưu của truyện bị xóa;
   - bản mới về trước khi query trả bản lưu thì query trả luôn bản mới (ghi cache lúc query chưa xong sẽ bị bản lưu đè lại);
   - lỗi mạng thì giữ bản lưu, không báo gì.
2. **Chưa có bản lưu:** tải mạng rồi lưu vào kho. Lỗi mạng thì ném lỗi riêng `ChapterNotSavedError` (không tự thử lại, để thông báo hiện ngay), trang đọc hiện "Chương này chưa được lưu để đọc offline" kèm link sang tab "Đã lưu". Lỗi khác (server lỗi) giữ như cũ: "Không tải được chương này" + "Thử lại".
- Nhận biết lỗi mạng bằng helper `isNetworkError` (`src/lib/network.ts`): `navigator.onLine === false` hoặc lỗi fetch của trình duyệt/supabase-js.
- Áp dụng cho cả chế độ cuộn liên tục (`ChapterStream` dùng chung `useChapter`) và giọng đọc (`useFetchChapter`).

## 4. Tải trước tự động
- Api chương thêm `getChapterRange(slug, from, count)` (mock + remote): các chương **đã xuất bản** có số ≥ `from`, tăng dần, tối đa `count`, mỗi chương có đủ `prev`/`next` như `getChapter`; trả kèm `total` = số chương đã xuất bản ≥ `from`. Bản remote dùng 3 truy vấn (thông tin truyện; `count + 1` chương có đếm tổng; chương liền trước `from`) thay vì gọi `getChapter` nhiều lần.
- Mở chương N lúc có mạng → khi trình duyệt rảnh (`requestIdleCallback`, không có thì `setTimeout`), tải 5 chương sau N **còn thiếu** rồi lưu kho. Chương ngay sau N được đưa luôn vào cache TanStack Query. Thay cho `usePrefetchChapter` hiện tại.
- Không tải trước khi offline hoặc bật tiết kiệm dữ liệu (`navigator.connection?.saveData`).
- "Còn thiếu": lần theo `next` của các chương đã lưu từ N; gặp chương chưa có thì bắt đầu tải từ đó. Đủ 5 chương đã có thì không gọi mạng. Bản lưu ghi "không có chương sau" hoặc chương sau nhảy cóc số (chương ở giữa lúc lưu còn là nháp) thì có thể đã cũ, nên hỏi máy chủ từ số kế tiếp.

## 5. Tải về chủ động
- Nút **"Tải về đọc offline"** ở trang chi tiết truyện (cạnh các nút đọc) và trong mục lục trang đọc; khóa khi offline hoặc truyện chưa có chương.
- Hộp thoại chọn: **20 chương**, **50 chương**, **toàn bộ N chương còn lại**. Điểm bắt đầu: trang đọc là chương đang đọc; trang truyện là chương trong lịch sử đọc, chưa đọc thì chương đầu tiên. Hộp thoại ghi "Đã có X chương trong máy".
- Tải từng đợt 20 chương bằng `getChapterRange`, bắt đầu từ chương đầu tiên **chưa có** trong máy (lần theo `next` như mục 4), nên bấm tải lại sau khi hủy chỉ lấy phần còn thiếu. Các chương đã có ở đoạn đầu được ghim tại chỗ và tính vào số chương đã chọn (chọn 20, đã có 5 thì tải thêm 15); chương đã có nằm rải rác giữa khoảng tải thì được tải lại (làm mới) và ghim.
- Thanh tiến độ + nút **Hủy**: báo "đã hủy" ngay, đợt đang tải dở không lưu, chương của các đợt trước vẫn giữ; bấm tải lại được luôn. Trạng thái tải nằm ở store Zustand `useDownloads` (không persist, chỉ là tiến độ), nên đóng hộp thoại hay chuyển trang trong app vẫn tải tiếp; đóng tab thì dừng.
- Xong: thông báo nổi "Đã tải 50 chương · 1,2 MB". Bộ nhớ đầy: dừng và báo "Bộ nhớ máy đầy, đã tải được X chương". Lỗi mạng giữa chừng: dừng và báo, bấm tải lại thì tiếp phần còn thiếu.
- Tải chủ động vẫn chạy khi bật tiết kiệm dữ liệu (người đọc tự bấm).
- Thông báo nổi dùng `sonner` (`npx shadcn@latest add sonner`), sửa component sinh ra để lấy theme từ Zustand `theme` thay vì `next-themes`. Dùng chung cho mục 1 và mục này.

## 6. Giới hạn dung lượng
- Chương **không ghim** tối đa **300**. Vượt thì xóa chương lâu không dùng nhất (`readAt`, chưa đọc thì `savedAt`), không xóa chương của truyện vừa lưu.
- Chương **ghim** không bị tự xóa và không tính vào giới hạn; chỉ mất khi người đọc xóa trong tab "Đã lưu".
- `QuotaExceededError`: xóa bớt 20% chương không ghim cũ nhất rồi thử lại một lần; vẫn lỗi thì bỏ qua (tự động) hoặc dừng và báo (tải chủ động).
- Lần lưu đầu tiên gọi `navigator.storage.persist()` (xin giữ dữ liệu lâu dài, tránh Safari tự xóa sau 7 ngày không dùng).

## 7. Giao diện khi offline
- Hook `useOnline()` (`src/hooks/useOnline.ts`): `navigator.onLine` + sự kiện `online`/`offline`.
- **Tab "Đã lưu"** trong tủ truyện (`/library?tab=saved`, tab thứ ba): chỉ đọc kho IndexedDB nên chạy hoàn toàn offline, cho cả khách.
  - Mỗi truyện: bìa, tên, tác giả, "Đã lưu 7 chương (12–18)", nhãn "Đã tải về" nếu có chương ghim, nút **"Đọc tiếp"** và nút xóa.
  - "Đọc tiếp" mở chương đã lưu có `readAt` mới nhất (chưa đọc chương nào thì chương nhỏ nhất), truyền `resumeState` để cuộn tới vị trí đã đọc.
  - Cuối tab: tổng dung lượng và nút **"Xóa tất cả"** (hỏi lại trước khi xóa).
  - Trống: "Chưa có chương nào được lưu. Chương bạn mở sẽ tự được lưu để đọc khi không có mạng."
- `useReadingTracker` ghi thêm `readAt`/`progress` vào kho (ngoài việc lưu lịch sử như cũ).
- **Banner offline** trong `MainLayout`, dưới header: "Bạn đang offline. Xem truyện đã lưu →". Các trang cần mạng giữ nguyên trạng thái chờ hiện có.
- **Trang đọc** (không có banner):
  - Mục lục (`ReaderChapterIndex`) không tải được khi offline → "Đang offline, các chương đã lưu:" + danh sách chương trong kho của truyện.
  - Bình luận chương: offline thì thay cả khu bình luận bằng dòng "Cần có mạng để xem và gửi bình luận chương N"; nút "Báo lỗi chương" bị khóa khi offline.
- **Phiên đăng nhập khi offline:** query `useSession` đặt `networkMode: 'always'` (đọc phiên trên máy, không bị dừng khi offline). Bản Supabase lưu hồ sơ lần trước (`auth-profile` trong localStorage); mở app lúc offline mà không tải được hồ sơ thì dùng bản này để vẫn nhận đúng tài khoản.

## 8. Đồng bộ lịch sử đọc
Chỉ bản remote cho người đã đăng nhập (bản mock và lịch sử của khách vốn lưu trên máy).
- Mutation `useSaveReadingProgress` đặt `networkMode: 'always'` (mặc định mutation bị dừng khi offline nên không tới được hàng chờ).
- `saveReadingProgress` gặp lỗi mạng → ghi hàng chờ `features/library/pendingProgress.ts` (localStorage `reading-progress-pending`, tách theo `userId`, mỗi truyện giữ lần mới nhất) và vẫn trả `ReadingProgress` như đã lưu, để lịch sử và "Đọc tiếp" trên máy cập nhật ngay.
- Component `OfflineSync` (cạnh `AuthSync` trong `Providers`): gửi hàng chờ của người đang đăng nhập khi mở app, khi có sự kiện `online` và khi đổi phiên. Gửi lần lượt qua RPC `save_reading_progress`, thành công thì xóa mục đó, lỗi mạng thì dừng chờ lần sau. Lỗi tạm thời của máy chủ (cổng API, quá giờ) thì giữ mục đó và gửi tiếp mục khác; chỉ bỏ mục khi lỗi gửi lại cũng vậy (lỗi nghiệp vụ như truyện đã bị gỡ, lỗi dữ liệu). Hàng chờ của tài khoản khác nằm yên tới khi tài khoản đó đăng nhập lại.
- Bản gửi sau thắng: nếu đồng thời đọc truyện đó trên máy khác, lần đồng bộ có thể ghi đè vị trí mới hơn. Chấp nhận ở đợt này (muốn tránh phải thêm thời điểm đọc vào RPC).
- Lượt đọc (`recordChapterView`) khi offline bỏ qua, không đếm bù.

## 9. File chính
- Mới: `src/features/offline/{store.ts,hooks.ts,prefetch.ts,downloads.ts,components/DownloadDialog.tsx,components/SavedList.tsx}`, `src/features/library/pendingProgress.ts`, `src/features/library/components/OfflineSync.tsx`, `src/hooks/useOnline.ts`, `src/lib/network.ts`, `src/app/pwa.tsx`, `src/components/common/OfflineBanner.tsx`, `src/components/common/InstallAppButton.tsx`, `src/components/ui/sonner.tsx`, icon PWA trong `public/`.
- Sửa: `vite.config.ts`, `vercel.json`, `index.html`, `src/main.tsx`, `src/app/providers.tsx`, `src/types/chapter.ts`, `src/features/chapters/{api.ts,api.mock.ts,api.remote.ts,hooks.ts}`, `src/features/library/api.remote.ts`, `src/features/reader/useReadingTracker.ts`, `src/features/reader/components/{ReaderChapterIndex,ChapterComments}.tsx`, `src/features/feedback/components/ReportChapterDialog.tsx`, `src/features/stories/StoryCover.tsx`, `src/pages/{ChapterReaderPage,LibraryPage,StoryDetailPage}.tsx`, `src/layouts/MainLayout.tsx`, `src/test/setup.ts`, `CLAUDE.md`.

## 10. Kiểm tra
- Test đơn vị:
  - Kho: lưu/đọc, xóa bớt khi vượt 300 (bỏ qua chương ghim và truyện vừa lưu), dọn khi `QuotaExceededError`, không có IndexedDB thì không lỗi.
  - Hàng chờ lịch sử: gộp theo truyện, tách tài khoản, gửi lại thành công thì xóa, lỗi mạng thì giữ.
  - `getChapterRange` (mock và remote): `prev`/`next` đúng khi số chương không liền nhau, `total` đúng.
- Test tích hợp (`renderApp`, `fake-indexeddb` nạp trong `src/test/setup.ts`):
  - Mở chương → 5 chương sau vào kho → giả offline (`navigator.onLine = false`, api chương ném lỗi mạng) → chuyển sang chương đã tải trước vẫn đọc được; chương chưa lưu hiện thông báo chưa lưu.
  - Có bản lưu cũ, server trả nội dung mới → màn hình cập nhật; server trả `null` → 404 và bản lưu bị xóa.
  - Tải về 20 chương từ trang truyện → offline → đọc được chương thứ 20; hủy giữa chừng giữ chương của các đợt đã xong, đợt đang tải dở không lưu; bấm lại chỉ tải phần thiếu.
  - Tab "Đã lưu": hiện truyện, "Đọc tiếp" đúng chương, xóa một truyện, xóa tất cả.
  - Mục lục trang đọc khi offline hiện chương đã lưu; bình luận/báo lỗi bị khóa.
- Kiểm tay: `npm run build && npm run preview` → Playwright bật offline, mở lại chương đã lưu và tab "Đã lưu", chụp 375px/768px/1440px, cả hai theme. Kiểm manifest và service worker trong DevTools (Application), Lighthouse mục PWA installable.

## Ngoài phạm vi
Web Push, Background Sync của service worker, đếm bù lượt đọc offline, đồng bộ vị trí theo thời điểm đọc, xem offline trang chi tiết truyện/danh sách/trang chủ, sửa trạng thái chờ của từng trang khi offline, hướng dẫn cài trên iOS.
