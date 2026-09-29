# Plan: Công cụ admin và nhập truyện hàng loạt

Trạng thái: ✅ xong (29/09/2026). Nối tiếp `plan-trang-quan-tri.md` (trang `/admin` lúc đầu chỉ xem).

Khác với plan ban đầu:
- Thanh tab admin ở màn hẹp cuộn ngang (đủ 7 mục) và tự đưa tab đang mở vào tầm nhìn.
- "Truyện cùng tác giả" tính theo chủ truyện **và** bút danh (`story_cards.author_key`), để truyện nhập của nhiều tác giả gốc dưới cùng tài khoản admin không bị gộp làm một.

## Phạm vi

1. **Hộp thư & báo lỗi:** đọc tin nhắn liên hệ, xem và xử lý báo lỗi chương của toàn web.
2. **Khóa user, gỡ truyện:** khóa/mở khóa tài khoản vi phạm; gỡ truyện vi phạm kèm lý do.
3. **Quản lý thể loại:** sửa tên/mô tả, xóa, gộp thể loại.
4. **Nhập truyện hàng loạt:** kéo thả nhiều file `.txt`, mỗi file một truyện; truyện đứng tên admin, kèm tên tác giả gốc.

Ngoài phạm vi đợt này: chọn truyện nổi bật (`curated_stories`), captcha.

## Route mới (menu admin)

| Đường dẫn | Trang |
|---|---|
| `/admin/inbox` | Hộp thư liên hệ (`?status=open\|handled\|all`, `?page=`) |
| `/admin/reports` | Báo lỗi chương toàn web (`?status=open\|resolved\|all`, `?page=`) |
| `/admin/genres` | Quản lý thể loại |
| `/admin/import` | Nhập truyện hàng loạt |

Trang Người dùng và Truyện có thêm nút thao tác (khóa, gỡ). Tổng quan có thêm ô "Tin nhắn chưa xử lý".

## 1. Hộp thư & báo lỗi

- **DB:** `contact_messages` thêm `handled_at timestamptz`.
- **RPC:**
  - `admin_contact_messages(status)`: danh sách tin nhắn, mới trước.
  - `admin_set_contact_handled(id, handled)`: đánh dấu đã xử lý / chưa xử lý.
  - `admin_reports(status)`: báo lỗi của mọi truyện, kèm tên truyện, số chương, người báo.
  - `admin_set_report_status(id, status)`: đổi trạng thái; trigger sẵn có tự đặt `resolved_at`.
- **UI:**
  - Hộp thư: bảng có tên, email (bấm để gửi mail), chủ đề, nội dung rút gọn (bấm để xem đủ), thời gian; nút "Đã xử lý".
  - Báo lỗi: bảng có truyện/chương (link sang trang đọc), lý do, ghi chú, người báo, thời gian; nút "Đã sửa".

## 2. Khóa user, gỡ truyện

- **Khóa tài khoản:**
  - `admin_set_user_banned(user_id, banned)` đặt `auth.users.banned_until = 'infinity'` (hoặc `null` khi mở khóa) và xóa `auth.sessions` của người đó.
  - Người bị khóa bị đăng xuất khi token hết hạn (tối đa 1 giờ) và không đăng nhập lại được. Trang đăng nhập báo "Tài khoản đã bị khóa" (Supabase trả mã `user_banned`).
  - Không khóa được chính mình hay admin khác.
  - Truyện và bình luận của người bị khóa giữ nguyên; muốn gỡ thì gỡ từng truyện.
  - Bảng Người dùng có cột trạng thái và nút Khóa / Mở khóa, xác nhận trước khi làm.
- **Gỡ truyện:**
  - `stories` thêm `taken_down_at`, `takedown_reason`.
  - `admin_set_story_takedown(story_id, reason)` gỡ truyện: chuyển về nháp và ghi lý do. Truyền `reason = null` là khôi phục.
  - Trigger chặn tác giả tự công khai lại truyện đang bị gỡ (mã `story_taken_down`).
  - Khu Sáng tác hiện thông báo "Truyện đã bị gỡ: {lý do}" và khóa nút Xuất bản.
  - Khôi phục thì truyện vẫn là nháp, tác giả tự xuất bản lại.
  - Bảng Truyện có nút Gỡ (nhập lý do) / Khôi phục.

## 3. Quản lý thể loại

- **RPC:**
  - `admin_update_genre(slug, name, description)`: đổi tên thì slug đổi theo (`story_genres` cập nhật theo nhờ `on update cascade`); trùng tên thể loại khác thì báo lỗi.
  - `admin_delete_genre(slug)`: truyện mất thể loại đó.
  - `admin_merge_genres(from, into)`: chuyển truyện sang thể loại đích (bỏ trùng) rồi xóa thể loại nguồn.
- **UI:** bảng thể loại (tên, slug, số truyện, người tạo, ngày tạo) với nút Sửa / Gộp vào… / Xóa, mỗi nút có hộp thoại xác nhận.
- **Bản giả:** chỉ sửa/xóa/gộp được thể loại do người dùng tạo; thể loại có sẵn của bản giả báo không hỗ trợ.

## 4. Nhập truyện hàng loạt

- **Tên tác giả gốc:**
  - `stories` thêm `author_name` (bút danh / tác giả gốc, không bắt buộc).
  - `story_cards` hiện `coalesce(author_name, tên tài khoản)`; tìm kiếm khớp cả tên này.
  - `create_story` / `update_story` nhận thêm `p_author_name`.
  - Form truyện trong khu Sáng tác có thêm ô "Tác giả / bút danh (không bắt buộc)" cho mọi người, để admin sửa được sau khi nhập.
- **Trang `/admin/import`:**
  - Kéo thả nhiều file `.txt` (mỗi file tối đa 2 MB); mỗi file tách chương bằng `parseChapters` sẵn có.
  - Bảng xem trước, mỗi truyện một hàng: tên truyện (lấy từ tên file, sửa được), tác giả gốc, thể loại (1–5), tiến độ (đang ra / hoàn thành), giới thiệu (≥ 30 ký tự), số chương và cảnh báo khi tách chương. Có ô "Áp dụng cho tất cả" cho tác giả, thể loại và tiến độ.
  - Nút "Nhập N truyện": chạy lần lượt từng truyện, gồm `createStory` → `importChapters` (xuất bản) → `publishStory`, dùng lại api của khu Sáng tác. Mỗi hàng hiện tiến độ; lỗi ở một truyện không dừng các truyện khác.
  - Xong có link tới từng truyện (trang công khai và khu Sáng tác).
- Truyện nhập thuộc tài khoản admin, nên admin sửa chương hay bìa ở khu Sáng tác như truyện thường.

## Kiểm tra

- `supabase/checks/rls_and_rules.sql`:
  - người thường gọi các RPC admin mới → `forbidden`;
  - admin gỡ truyện → tác giả không công khai lại được;
  - khóa / mở khóa đổi `banned_until`;
  - gộp thể loại chuyển đúng truyện, không trùng;
  - đổi tên thể loại cập nhật `story_genres`.
- Test api bản giả cho từng hàm mới. Test luồng: hộp thư, báo lỗi, khóa user (không đăng nhập được), gỡ truyện (khu Sáng tác hiện lý do, không xuất bản được), thể loại, nhập 2 file `.txt`.
- Xem giao diện ở 375 / 768 / 1440px, cả hai theme.

## Cách triển khai

Một nhánh `admin-tools-and-bulk-import`, commit theo từng phần (1 → 4), mỗi phần một migration riêng. Chạy thử migration trong transaction rồi rollback trước khi push lên DB thật.
