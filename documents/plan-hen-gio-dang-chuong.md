# Plan: Hẹn giờ đăng chương

Trạng thái: ✅ xong (08/10/2026), migration `chapter_scheduling` và `cron_log_cleanup` đã push lên DB production. Nhánh `chapter-scheduling`. App di động làm sau.

**Khác so với bản spec đã duyệt** (phát hiện lúc làm):
- `private.publish_due_chapters(p_now timestamptz default now())`: thêm tham số để ca kiểm tra SQL giả lập "tới giờ" (now() không đổi trong transaction); cron gọi không tham số.
- `schedule_chapters`: chương không phải nháp báo `invalid_schedule` (spec ghi `not_found`); truyện không phải của mình, chương không có vẫn là `not_found`.
- Hẹn giờ chương đang xuất bản báo `invalid_schedule` ngay ở trigger (chỉ bỏ giờ hẹn khi chương *chuyển* sang xuất bản).
- Chọn giờ một chương dùng `ResponsiveDialog` (hộp thoại từ `sm`, sheet trên điện thoại) thay vì popover, cho đồng bộ với Xếp lịch và nút Đề cử.
- Thêm migration `cron_log_cleanup`: job `cleanup-cron-logs` mỗi ngày xóa `cron.job_run_details` cũ hơn 7 ngày (job xuất bản ghi ~1.440 dòng log / ngày, gói Free giới hạn DB 500 MB).
- Giới hạn xa nhất là 365 ngày (không phải "1 năm", tránh lệch năm nhuận giữa client và DB).
- App di động: khi đồng bộ (`sync-from-web`) cần lấy `types/story.ts` (`nextChapter`), `types/chapter.ts` (`scheduledAt`), `stories/shared.ts` (`upcomingChapter`), `cards.remote.ts`, `lib/format.ts` (`formatScheduleTime`).

## Context

Tác giả hay viết dồn nhiều chương rồi muốn ra đều đặn để giữ nhịp cho người theo dõi. Hiện chương chỉ có nháp hoặc xuất bản ngay. Đây là việc thứ hai trong nhóm "đáng làm, không gấp" (sau thích / sửa bình luận).

Đã chốt với người dùng (08/10/2026):
- **Cách hẹn:** hẹn từng chương (chọn ngày giờ) + công cụ **Xếp lịch** cho nhiều chương nháp.
- **Nhịp xếp lịch:** mỗi ngày hoặc các thứ đã chọn trong tuần, một giờ đăng, 1–3 chương mỗi lần.
- **Người đọc:** thấy "Chương N ra lúc …" cho chương hẹn sớm nhất (không lộ tiêu đề, nội dung).
- **Cách chạy:** cột `scheduled_at` + `pg_cron` mỗi phút chuyển chương tới giờ sang xuất bản (chậm tối đa ~1 phút); mọi trigger sẵn có (published_at, story_stats, thông báo đẩy) tự chạy như khi tác giả bấm xuất bản.
- **Chỉ làm web.** App di động làm sau qua `sync-from-web`; thay đổi DB tương thích ngược.

Ngoài phạm vi: lịch cố định theo truyện, hẹn giờ trong form tạo truyện, hẹn giờ ở nhập `.txt` và nhập hàng loạt, thông báo cho tác giả khi chương tự ra, app di động.

## 1. Luật nghiệp vụ

- Chỉ **chương nháp** có giờ hẹn; chương đang xuất bản muốn hẹn thì phải chuyển về nháp trước. Chương từng xuất bản rồi chuyển về nháp vẫn hẹn được: tới giờ thì xuất bản lại, giữ `published_at` cũ và không gửi thông báo đẩy (trigger chỉ báo chương xuất bản lần đầu).
- Giờ hẹn phải **sau hiện tại ít nhất 1 phút** và **trong vòng 1 năm**; sai thì `invalid_schedule`. Chỉ kiểm tra khi giờ hẹn được đặt hoặc đổi (sửa nội dung chương sát giờ không lỗi).
- Xuất bản chương (tay hoặc tự động) thì giờ hẹn tự bỏ. Hủy hẹn = đặt `null`, chương vẫn là nháp.
- Tới giờ, chương được xuất bản như khi tác giả bấm "Xuất bản chương": đặt `published_at`, cập nhật chương mới nhất và số chương, gửi thông báo đẩy cho người theo dõi (cooldown 30 phút mỗi truyện, nhiều chương cùng giờ chỉ một thông báo), không tính vào hạn mức tác giả.
- Truyện chưa công khai (nháp, chờ duyệt, bị gỡ) thì chương vẫn được xuất bản đúng giờ nhưng người đọc chưa thấy (truyện còn ẩn).
- Chương xuất bản tự động lỗi (trigger chặn) thì bỏ giờ hẹn, giữ nháp; các chương khác vẫn ra.
- Số chương: hẹn giờ không đổi luật số chương (chương chưa từng xuất bản vẫn đổi số được tới lúc ra).

## 2. Database (migration `chapter_scheduling`)

- `create extension if not exists pg_cron` (Supabase: schema `pg_catalog`, job ở `cron.job`).
- `chapters.scheduled_at timestamptz` (null: không hẹn); `check (scheduled_at is null or status = 'draft')`.
- Index một phần `chapters (scheduled_at) where scheduled_at is not null` cho cron và tính chương sắp ra.
- Quyền: `grant insert (scheduled_at), update (scheduled_at) on chapters to authenticated` (RLS sẵn có: chỉ chủ truyện).
- `private.chapters_before_change` (bản mới, giữ mọi luật cũ) thêm:
  - `new.status = 'published'` thì `new.scheduled_at := null`.
  - Giờ hẹn được đặt hoặc đổi (`insert` có giá trị, hoặc `update` mà `new.scheduled_at is distinct from old.scheduled_at` và khác null): ngoài khoảng `(now() + 1 phút, now() + 1 năm]` thì `invalid_schedule`.
- `private.publish_due_chapters()` (DEFINER): duyệt các chương `status = 'draft' and scheduled_at <= now()` theo `scheduled_at, number`; mỗi chương một khối `begin … exception when others` cập nhật `status = 'published'`; lỗi thì `scheduled_at = null` và `raise warning`.
- `cron.schedule('publish-scheduled-chapters', '* * * * *', 'select private.publish_due_chapters()')`.
- `story_stats.next_chapter_number integer`, `story_stats.next_chapter_at timestamptz`: chương nháp có `scheduled_at` sớm nhất của truyện. `private.chapters_after_change` (bản mới) tính thêm hai cột này.
- View `story_cards` thêm `next_chapter_number`, `next_chapter_at` (tạo lại view, giữ các cột cũ và thứ tự).
- RPC `schedule_chapters(p_story_id uuid, p_items jsonb)` (INVOKER, `language plpgsql`): `p_items` = `[{"number": int, "at": timestamptz}]`; cập nhật `scheduled_at` của các chương nháp của truyện trong một transaction; chương không có, không phải nháp hoặc không phải của mình thì `not_found` (cả lịch không lưu); trả số chương đã xếp.
- Ca kiểm tra trong `supabase/checks/rls_and_rules.sql`: chủ truyện hẹn được, người khác không; `invalid_schedule` (quá gần, quá xa); chương xuất bản không có giờ hẹn (xuất bản thì giờ hẹn bị bỏ; check constraint); `publish_due_chapters()` xuất bản chương tới giờ (giả lập bằng ghi thẳng `scheduled_at` quá khứ với quyền chủ phiên), bỏ qua chương chưa tới giờ; `story_cards.next_chapter_*` đúng; người đọc không thấy tiêu đề chương hẹn giờ; `schedule_chapters` lưu cả lịch hoặc không lưu gì.

## 3. Dữ liệu và api

### Kiểu

```ts
// src/types/chapter.ts
type Chapter = { ...; scheduledAt: string | null }
type ChapterContent = { story: { ...; nextChapter: NextChapter | null }; ... }

// src/types/story.ts
type NextChapter = { number: number; at: string }
type Story = { ...; nextChapter: NextChapter | null }
```

### `features/studio`

| Hàm | Việc |
|---|---|
| `saveChapter(storyId, input, { publish, scheduledAt })` | `scheduledAt`: string đặt / đổi giờ hẹn, `null` bỏ hẹn, không truyền thì giữ nguyên. `publish: true` thì xuất bản ngay (bỏ giờ hẹn) |
| `setChapterSchedule(storyId, number, scheduledAt \| null)` | Đặt / đổi / hủy giờ hẹn của một chương nháp |
| `scheduleChapters(storyId, items)` | `items: { number, scheduledAt }[]`; remote gọi `rpc('schedule_chapters')`; lưu cả lịch hoặc không lưu gì |

- Lỗi: `StudioError('invalid_schedule')` ("Giờ hẹn phải sau ít nhất 1 phút và trong vòng 1 năm."); hẹn giờ chương đã xuất bản cũng là `invalid_schedule`. Thêm thông báo vào `studioErrorMessage`.
- `planSchedule(numbers, { start, time, weekdays, perSlot }, now?)` ở `studio/shared.ts` (hàm thuần): `numbers` là số chương theo thứ tự; `start` ngày bắt đầu (`YYYY-MM-DD`), `time` (`HH:mm`), `weekdays` (0 = Chủ nhật … 6), `perSlot` 1–3. Trả `{ number, scheduledAt }[]` (ISO). Lần đăng đầu là ngày ≥ `start` đúng thứ đã chọn; giờ đó đã qua (hoặc chưa đủ 1 phút) thì sang lần kế tiếp. Giờ theo múi giờ của máy.

### `features/stories`, `features/chapters`

- Thẻ truyện (`cards.remote.ts`): `nextChapter` từ `next_chapter_number`, `next_chapter_at`.
- `getChapter`: `story.nextChapter` lấy từ truy vấn `story_cards` sẵn có.
- Hàm thuần `upcomingChapter(next, now?)` (`features/stories/shared.ts`): trả `next` khi giờ chưa qua, không thì `null` (cron chưa kịp chạy).

### Bản giả

- `mocks/userContent.ts`: chương lưu thêm `scheduledAt` (dữ liệu cũ thiếu thì `null`). `loadChapters(storyId)` gọi `publishDue()`: chương nháp có `scheduledAt <= now` chuyển sang `published`, `publishedAt = scheduledAt`, bỏ giờ hẹn, ghi lại.
- `toStory()` tính `nextChapter` từ chương nháp có giờ hẹn sớm nhất còn ở tương lai.
- Kiểm tra giờ hẹn như DB (≥ 1 phút, ≤ 1 năm, chỉ chương nháp).

## 4. Giao diện

### Trình soạn chương (`ChapterEditor`, chương nháp)

- Thanh nút dưới đáy: Hủy · Lưu nháp · **Hẹn giờ** · Xuất bản chương.
- **Hẹn giờ** mở `SchedulePicker` (popover từ `sm`, sheet từ đáy trên điện thoại): ô ngày (`type="date"`), ô giờ (`type="time"`, `step` 5 phút), nút "Lưu và hẹn giờ"; có giờ hẹn thì thêm "Hủy hẹn giờ". Lỗi giờ hiện ngay dưới ô.
- Chương có giờ hẹn: cạnh huy hiệu trạng thái hiện chip "Hẹn 20:00 · T6, 10/10"; nút đổi thành "Đổi giờ hẹn".

### Danh sách chương (`ChapterTable`)

- `StatusBadge` thêm loại **Đã hẹn giờ** kèm giờ ngắn ("T6 20:00").
- Menu "…" của chương nháp: "Hẹn giờ đăng…" (mở `SchedulePicker`), "Hủy hẹn giờ" khi đã hẹn.
- Nút **Xếp lịch** trên đầu danh sách (khi có ≥ 2 chương nháp) mở `ScheduleDialog`:
  - Chọn chương (các chương nháp, mặc định chọn hết, theo số chương).
  - Ngày bắt đầu, giờ đăng, các thứ (7 nút T2…CN, mặc định chọn hết), số chương mỗi lần (1–3).
  - Xem trước: từng chương với giờ ra dự kiến (từ `planSchedule`); chương đang có giờ hẹn ghi chú "thay giờ cũ".
  - "Lưu lịch (N chương)" gọi `scheduleChapters`; xong thì đóng và báo bằng toast.

### Người đọc

- Trang chi tiết truyện (phần đầu, dưới dòng chương mới nhất): "Chương 12 ra lúc 20:00 thứ Sáu, 10/10" khi `upcomingChapter(story.nextChapter)` có giá trị.
- Cuối chương (`ChapterEnd`): đang ở chương mới nhất (không có chương sau) thì hiện cùng dòng đó thay chỗ trống của "Chương sau".
- Định dạng giờ chung `formatScheduleTime(iso, now?)` (`src/lib/format.ts`): "20:00 hôm nay", "20:00 ngày mai", còn lại "20:00 thứ Sáu, 10/10"; theo múi giờ của máy.

## 5. Kiểm tra

- **`planSchedule`**: mỗi ngày; các thứ đã chọn; 2 chương mỗi lần; ngày bắt đầu không đúng thứ thì sang thứ gần nhất; giờ hôm nay đã qua thì sang lần kế; thứ tự số chương.
- **`formatScheduleTime`, `upcomingChapter`**: hôm nay / ngày mai / ngày khác; giờ đã qua thì `null`.
- **Api bản giả** (`features/studio/api.test.ts`): hẹn, đổi, hủy; giờ sai và chương đã xuất bản bị chặn (`invalid_schedule`); `vi.setSystemTime` qua giờ hẹn thì chương tự ra (có `publishedAt`, `latestChapter` của truyện đổi, `nextChapter` sang chương hẹn kế); xuất bản tay bỏ giờ hẹn; `scheduleChapters` lưu cả lịch, một chương sai thì không lưu gì.
- **Bản remote** (client giả): `saveChapter` gửi `scheduled_at` (chỉ khi có truyền), `setChapterSchedule` update đúng cột, `scheduleChapters` gọi `rpc('schedule_chapters')`, map `invalid_schedule` / `not_found`; thẻ truyện map `nextChapter`.
- **Test luồng**: hẹn giờ từ trình soạn thấy chip giờ hẹn và huy hiệu ở danh sách chương; xếp lịch 3 chương thấy xem trước đúng rồi lưu; trang truyện hiện "Chương … ra lúc …"; tới giờ (giả thời gian) thì chương hiện trong danh sách chương của người đọc.
- **SQL**: như mục 2.
- Giao diện ở 375 / 768 / 1440px, cả hai theme.

## 6. Các bước

1. `planSchedule`, `formatScheduleTime`, `upcomingChapter` + test.
2. Bản giả + test: hẹn giờ, tự xuất bản, `nextChapter`, `scheduleChapters`.
3. Migration, ca kiểm tra SQL, thử trong transaction; push (hỏi người dùng), advisors, sinh kiểu; bản remote + test.
4. Giao diện Sáng tác (`SchedulePicker`, `ScheduleDialog`, huy hiệu, menu) + test luồng.
5. Giao diện người đọc (trang truyện, cuối chương) + test luồng.
6. Cập nhật `thiet-ke-database.md`, `CLAUDE.md`, lộ trình; ghi chú app di động cần đồng bộ; kiểm tra giao diện; chạy toàn bộ test, lint, build; commit, gộp vào `main`.
