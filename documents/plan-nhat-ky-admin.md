# Plan: Nhật ký thao tác admin

Trạng thái: đã làm xong trên nhánh `admin-audit-log` (30/10/2026), chờ đẩy migration. Spec duyệt 30/10/2026. Nối tiếp `plan-cong-cu-admin.md`, `plan-admin-phieu-va-danh-gia.md`.

Khác với plan:
- Bảng là `private.admin_audit_log` (schema `private`, không lộ ra API, không cần policy) thay vì bảng `public` có RLS.
- RPC `admin_audit_log(query)` chỉ nhận từ khóa; lọc nhóm (`?group=`, cột `action_group`) và người làm (`?actor=<id>`) làm bằng PostgREST. Trang không có sắp xếp theo cột: luôn mới nhất trước.
- `actor_id` về `null` khi tài khoản người làm bị xóa (trang ghi "(đã xóa)", tên lúc đó còn trong `actor_name`).
- `comment.dismiss_reports` chỉ ghi khi có báo cáo đang mở để bỏ qua.

## Context

Admin khóa user, gỡ hay duyệt truyện, xóa bình luận, sửa thể loại... nhưng DB không ghi lại ai làm gì và lúc nào. Một admin thì chưa sao; từ hai admin trở lên thì không truy được ai đã khóa một tài khoản hay gỡ một truyện, và không có bằng chứng khi có tranh chấp với tác giả.

## Đã đề xuất (chờ chốt)

- **Ghi ở DB, không ở client:** mỗi RPC ghi của admin gọi `private.admin_log(...)` trong cùng giao dịch, nên không thể thao tác mà không để lại dòng nhật ký, và dòng nhật ký không giả mạo được từ trình duyệt.
- **Chỉ thêm, không sửa/xóa:** không ai (kể cả admin) sửa hay xóa dòng nhật ký qua API; chỉ đọc.
- **Chụp lại tên lúc đó:** lưu cả tên người làm và tên đối tượng (tên truyện, tên user, tên thể loại, trích bình luận) vì đối tượng có thể bị xóa sau này (bình luận, thể loại, tài khoản).
- **Ai xem được:** mọi quản trị viên.
- **Giữ vô hạn**, chưa có xóa dữ liệu cũ.

## Phạm vi

Ghi 12 thao tác ghi của admin:

| Nhóm | `action` | Đối tượng | Chi tiết ghi kèm |
|---|---|---|---|
| Người dùng | `user.ban`, `user.unban` | tài khoản | |
| Truyện | `story.takedown`, `story.restore` | truyện | lý do |
| Truyện | `story.approve`, `story.reject` | truyện | lý do từ chối |
| Bình luận | `comment.delete` | bình luận | nội dung, số trả lời bị xóa theo, người viết |
| Bình luận | `comment.dismiss_reports` | bình luận | số báo cáo bị bỏ qua |
| Điểm chấm | `rating.delete` | điểm chấm | người chấm, điểm |
| Thể loại | `genre.update`, `genre.delete`, `genre.merge` | thể loại | tên cũ → mới, số truyện bị ảnh hưởng, thể loại đích |
| Trang chủ | `curated.set` | danh sách (`featured`/`editor_pick`) | số truyện, id theo thứ tự |
| Hộp thư, báo lỗi | `message.handle`, `message.unhandle`, `report.set_status` | tin nhắn / báo lỗi | trạng thái mới |

Không ghi: các lần xem (đọc), nhập truyện hàng loạt (đi qua api Sáng tác của chính admin, truyện đã đứng tên admin).

## Dữ liệu

Bảng `admin_audit_log`: `id bigint identity`, `actor_id uuid` (`on delete set null`), `actor_name text`, `action text`, `target_type text` (`user`/`story`/`comment`/`rating`/`genre`/`list`/`message`/`report`), `target_id text`, `target_label text`, `details jsonb`, `created_at timestamptz default now()`. Index theo `created_at desc`, `actor_id`, `action`. RLS bật, không `grant` cho `anon`/`authenticated`: chỉ hàm DEFINER đọc/ghi.

## RPC

- `private.admin_log(action, target_type, target_id, target_label, details)`: DEFINER, lấy `auth.uid()` làm người làm; không có `grant execute` cho ai (chỉ các RPC admin khác gọi).
- Sửa 12 hàm `private.admin_*` ở trên bằng `create or replace` để gọi `admin_log` sau khi thao tác thành công (thao tác lỗi thì không ghi).
- `admin_audit_log(query, action_group)`: đọc nhật ký, mới trước; tìm theo tên người làm hoặc đối tượng; lọc nhóm (`user`, `story`, `comment`, `rating`, `genre`, `list`, `inbox`). Lọc người làm (`?actor=<id>`), sắp xếp, phân trang làm bằng PostgREST như các bảng admin khác.

## Giao diện

- Trang `/admin/audit` (menu "Nhật ký"): bảng Thời gian, Người làm, Thao tác (nhãn tiếng Việt), Đối tượng (link sang trang liên quan khi còn), Chi tiết (rút gọn, bấm để xem đủ).
- Lọc: tìm, nhóm thao tác, người làm. Chỉ đọc.
- Bản giả: lưu `localStorage` (`mock-admin-audit`), các hàm admin của bản giả ghi cùng chỗ; hiển thị giống bản thật.

## Kiểm tra

- `supabase/checks/rls_and_rules.sql`: người thường gọi `admin_audit_log` → `forbidden`; mỗi thao tác chính (khóa, gỡ truyện, xóa bình luận, gộp thể loại) để lại đúng một dòng với đúng người làm; thao tác lỗi (`not_found`) không để lại dòng; không `insert`/`update`/`delete` trực tiếp được bảng (`42501`).
- Test api bản giả và test luồng trang.
- Xem giao diện ở 375 / 768 / 1440px, cả hai theme.

## Cách triển khai

Một nhánh `admin-audit-log`, một migration. Không viết `trien-khai-*.md`. Chạy thử migration trong transaction rồi rollback trước khi đẩy lên DB thật. Migration đẩy lên DB thật trước, rồi mới push web.
