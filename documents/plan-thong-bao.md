# Plan: Hộp thông báo trên web và admin gửi thông báo

Trạng thái: spec duyệt 30/10/2026. Phần 1 (hộp thông báo) xong trên nhánh `notifications`, migration chưa đẩy lên DB thật; phần 2 chưa làm.

Khác với plan (phần 1):
- Không có RPC `notifications_unread_count` và `mark_all_notifications_read`: đếm và đánh dấu hết đọc bằng PostgREST ngay trên bảng (RLS đã lọc theo chủ).
- Thêm cột `chapter_count` để gộp thông báo chương mới.
- Bản giả không sinh thông báo chương mới (chỉ bình luận và duyệt / gỡ truyện). Nối tiếp `plan-theo-doi-loi.md`, `plan-nhat-ky-admin.md`; thông báo đẩy của app ở migration `20261002025309_push_notifications.sql`.

## Context

- Web chưa có thông báo nào. Người đọc chỉ thấy "có chương mới" khi mở Tủ truyện (`library_update_count`); tác giả không biết khi có người trả lời bình luận, khi truyện được duyệt, bị từ chối hay bị gỡ.
- App di động đã có thông báo đẩy chương mới (Expo Push), nhưng chưa có chỗ xem lại thông báo, và chưa gửi thật được (thiếu tài khoản Expo, Apple, Firebase).
- Admin chưa có cách báo tin chung (bảo trì, thay đổi quy định).

Hướng: **hộp thông báo trong ứng dụng**, lưu ở DB, không phụ thuộc Firebase hay tài khoản bên thứ ba. Web Push (hiện thông báo khi đóng tab) để sau.

## Phạm vi

Hai phần, mỗi phần một nhánh và một migration riêng:

1. **Hộp thông báo**: bảng `notifications`, chuông và trang `/notifications`, 4 loại sự kiện.
2. **Admin gửi thông báo chung**: trang `/admin/announcements`.

Ngoài phạm vi: Web Push (VAPID), thông báo đẩy cho loại mới trên app, tắt bật từng loại, email, màn hộp thông báo trong app di động (app đọc cùng bảng sau).

## 1. Hộp thông báo

### Dữ liệu

Bảng `public.notifications`:

| Cột | Ghi chú |
|---|---|
| `id` bigint identity | |
| `user_id` | người nhận, `references profiles on delete cascade` |
| `type` | `chapter.new` \| `comment.reply` \| `comment.story` \| `story.approved` \| `story.rejected` \| `story.takedown` \| `story.restored` \| `announcement` |
| `title` (1–120), `body` (≤300) | chụp sẵn, không phụ thuộc dữ liệu gốc còn hay mất |
| `link` | đường dẫn trong web (`/story/<slug>/chapter-<n>`...), null: không bấm được |
| `story_id` | null được, `on delete cascade`, để gộp thông báo chương mới |
| `created_at`, `read_at` | `read_at` null = chưa đọc |

- RLS: chủ đọc, chủ sửa **chỉ** `read_at` (grant cột), chủ xóa. **Không ai insert qua API**: chỉ `private.notify(...)` (DEFINER) ghi.
- Index `(user_id, created_at desc)` và index một phần `(user_id) where read_at is null` để đếm chưa đọc.
- Giữ 90 ngày: `notify` xóa thông báo cũ quá 90 ngày của chính người nhận khi ghi (không cần cron).

### Sự kiện (trigger / RPC có sẵn gọi `private.notify`)

| Loại | Khi nào | Người nhận | Nội dung |
|---|---|---|---|
| `chapter.new` | chương xuất bản lần đầu, ngay chỗ `send_chapter_push` đang chạy | người theo dõi truyện, trừ tác giả | "Tên truyện" / "Chương N: tiêu đề". Nếu người đó còn một thông báo `chapter.new` chưa đọc của truyện này thì **cập nhật** nó ("3 chương mới...") thay vì thêm dòng, nên không dội. Không dùng cooldown 30 phút của push |
| `comment.reply` | thêm bình luận có `parent_id` | người viết bình luận gốc, trừ chính mình và trừ người đã chặn người trả lời | trích nội dung trả lời, link tới bình luận |
| `comment.story` | thêm bình luận gốc | chủ truyện, trừ khi chính mình viết | trích nội dung |
| `story.approved` / `story.rejected` / `story.takedown` / `story.restored` | `admin_review_story`, `admin_set_story_takedown` | chủ truyện | kèm lý do (từ chối, gỡ) |

Thông báo chặn nhau: người nhận đã chặn người viết thì không nhận `comment.*` (dùng `private.my_blocked_ids()` / bảng chặn có sẵn).

### API (RPC, bọc public như các RPC khác)

- `notifications_unread_count()` → số chưa đọc (đã đăng nhập).
- Danh sách: `from('notifications').select().order('created_at', desc).range()` (RLS đã lọc theo chủ).
- Đánh dấu đã đọc: `update({ read_at }).in('id', ...)` và `mark_all_notifications_read()`.
- Xóa: `delete().eq('id')`.

### Giao diện (không dùng Ant Design, như phần người đọc)

- **Chuông** trong header, chỉ khi đã đăng nhập: huy hiệu số chưa đọc (tối đa "99+"). Desktop mở popover 8 thông báo mới nhất + "Xem tất cả"; màn hẹp bấm thẳng sang trang. Đếm chưa đọc làm mới khi quay lại tab và mỗi 60 giây (không dùng realtime).
- **Trang `/notifications`**: danh sách phân trang, dòng chưa đọc nổi bật, bấm thì đánh dấu đã đọc và đi tới `link`; nút "Đánh dấu tất cả đã đọc", xóa từng dòng. Trạng thái trống, lỗi, tải lại theo mẫu các trang khác.
- `noindex`, vào khi chưa đăng nhập thì chuyển sang đăng nhập (như `/library`). Không thêm vào sitemap.
- Hai backend: bản thật qua Supabase, bản giả lưu localStorage (`mock-notifications`), bản giả tự sinh thông báo ở các thao tác giả tương ứng (duyệt truyện, trả lời bình luận) để test luồng.

### Kiểm tra

- `supabase/checks/rls_and_rules.sql`: người dùng không insert được; không đọc / sửa / xóa thông báo của người khác; chỉ sửa được `read_at`; thêm chương → người theo dõi có thông báo, tác giả không; thêm hai chương liền → vẫn một dòng; trả lời bình luận → chủ bình luận gốc có thông báo, tự trả lời mình thì không, người chặn thì không; duyệt / từ chối / gỡ truyện → chủ truyện có thông báo.
- Test api bản giả, test luồng chuông và trang (`notifications-flow.test.tsx`).
- Xem giao diện ở 375 / 768 / 1440px, hai theme.

## 2. Admin gửi thông báo chung

- RPC `admin_send_announcement(title, body, link)`: tạo một dòng `announcement` cho **mọi tài khoản** (một câu `insert ... select` từ `profiles`), trả về số người nhận. Chỉ admin; kiểm tra độ dài; `link` phải là đường dẫn nội bộ (bắt đầu bằng `/`) hoặc rỗng.
- Ghi nhật ký `announcement.send` (nhóm mới `announcement`) kèm tiêu đề, nội dung, số người nhận; thêm vào nhãn ở trang Nhật ký.
- Trang `/admin/announcements`: form (tiêu đề, nội dung, link tùy chọn, xem trước) và nút gửi có xác nhận ghi rõ số người sẽ nhận; bên dưới là các lần đã gửi (đọc từ nhật ký, không thêm bảng). Menu "Thông báo" ở `AdminLayout`.
- Không sửa hay thu hồi thông báo đã gửi (người dùng tự xóa dòng của mình). Chưa hẹn giờ, chưa gửi theo nhóm.
- Quy mô: một câu insert là đủ đến vài chục nghìn tài khoản; nếu vượt thì cần chia lô.

## Ghi chú

- Thông báo đẩy trên app giữ nguyên: chỉ chương mới. Khi có tài khoản Expo / Firebase, mở rộng sang các loại khác bằng cách gửi thêm từ `private.notify`.
- App di động có thể đọc cùng bảng `notifications` để làm hộp thông báo; việc đó thuộc repo app, làm sau.
- Cần sửa `documents/thiet-ke-database.md` (bảng, RLS, RPC mới) và `CLAUDE.md` sau khi làm.
- Quy trình: chạy thử migration trong transaction rồi rollback; không viết `trien-khai-*.md`.
