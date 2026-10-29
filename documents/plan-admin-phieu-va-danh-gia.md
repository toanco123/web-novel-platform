# Plan: Admin xem phiếu đề cử và đánh giá

Trạng thái: phần 1 (phiếu) xong trên nhánh `admin-votes`, chưa đẩy migration lên DB thật (29/10/2026); phần 2 (điểm chấm) chưa làm. Spec duyệt ngày 29/10/2026. Nối tiếp `plan-cong-cu-admin.md`, `plan-diem-danh-va-de-cu.md`.

Khác với plan (phần 1):
- RPC chỉ nhận từ khóa tìm (`admin_vote_stories(query)`, `admin_vote_users(query)`); lọc, sắp xếp, phân trang làm bằng PostgREST ngay trên kết quả, như các bảng admin khác.
- Bộ lọc "Dấu hiệu: Tập trung" (`?flag=concentrated`) ở tab Theo truyện, thêm so với plan.
- Tab Theo người dùng chỉ liệt kê người có hoạt động phiếu (đã điểm danh, đã đề cử hoặc đang có phiếu).
- Cột "Chuỗi gần nhất" là chuỗi ở lần điểm danh gần nhất, không xét còn liên tiếp tới hôm nay.
- Bấm tên người đề cử nhiều nhất (tab Theo truyện) cũng mở sổ phiếu.

## Context

Rà menu admin (10 mục) với các tính năng đã có, còn thiếu chỗ để admin xem và xử lý hai nhóm dữ liệu:

- **Phiếu đề cử** (`wallet_balances`, `wallet_ledger`, `daily_checkins`, `story_votes`): RLS chỉ cho chủ đọc dữ liệu của mình nên admin không tra được. Không phát hiện được một người lập nhiều tài khoản để điểm danh lấy phiếu rồi dồn đề cử cho một truyện.
- **Điểm chấm** (`ratings`, chỉ có `score` 1–5, **không có nội dung review**): admin không xem hay xóa được điểm chấm spam (một tài khoản chấm 1 sao hàng loạt, nhiều tài khoản mới chấm 5 sao cho một truyện).

Đã kiểm tra, không làm: báo cáo bình luận (trang Bình luận đã có chế độ "Bị báo cáo" làm mặc định).

## Phạm vi

1. **Phiếu & đề cử** (`/admin/votes`): tra cứu và phát hiện bất thường.
2. **Điểm chấm** (`/admin/ratings`): xem và xóa điểm chấm.

Ngoài phạm vi: cộng/trừ phiếu thủ công, khóa đề cử, nhật ký thao tác admin, gửi push, trang cài đặt.

## 1. Phiếu & đề cử

- **RPC (chỉ admin, `private.require_admin()`, tên `admin_*`, bọc public như các RPC admin khác):**
  - `admin_vote_stories(q, sort, order, page, page_size)`: theo truyện: tên, tổng phiếu, phiếu 7 ngày, số người đề cử khác nhau, **tỉ lệ phiếu của người đề cử nhiều nhất**, để phát hiện dồn phiếu.
  - `admin_vote_users(q, sort, order, page, page_size)`: theo người dùng: tên, số dư phiếu, tổng phiếu đã đề cử, số lần điểm danh, chuỗi hiện tại, ngày tạo tài khoản.
  - `admin_user_ledger(user_id)`: sổ giao dịch của một người (đọc `wallet_ledger`, 100 dòng mới nhất), để đối soát số dư.
- **UI:** trang có hai tab "Truyện" và "Người dùng" (`?view=stories|users`), bảng lọc/sắp xếp theo mẫu `tableParams`. Bấm một người mở hộp thoại sổ giao dịch (chỉ đọc). Hàng nghi vấn (một người chiếm ≥ 50% phiếu truyện, ≥ 10 phiếu) có nhãn "Tập trung".
- **Không sửa dữ liệu:** trang chỉ để xem. Xử lý vi phạm vẫn qua khóa user ở trang Người dùng.

## 2. Điểm chấm

- **RPC:**
  - `admin_ratings(q, user_only, sort, order, page, page_size)`: người chấm, truyện, điểm, thời gian; kèm số điểm đã chấm của người đó và điểm trung bình họ chấm (spam 1 sao hiện rõ).
  - `admin_delete_rating(user_id, story_id)`: xóa một điểm chấm; trigger đếm sẵn có tự cập nhật điểm trung bình và `rating_count` của truyện.
- **UI:** bảng điểm chấm (`/admin/ratings`), lọc theo điểm (1–5), sắp xếp theo "số điểm đã chấm", nút Xóa có xác nhận. Cột người chấm liên kết sang trang Người dùng.

## Menu và route

Thêm "Phiếu" (`/admin/votes`) và "Điểm chấm" (`/admin/ratings`) vào `AdminLayout`; thanh tab vốn đã cuộn ngang ở màn hẹp. Tổng quan không đổi.

## Kiểm tra

- `supabase/checks/rls_and_rules.sql`: người thường gọi các RPC mới → `forbidden`; xóa điểm chấm cập nhật lại trung bình truyện.
- Test api bản giả cho từng hàm mới (`api.test.ts`) và test luồng trang (`admin-flow.test.tsx`).
- Xem giao diện ở 375 / 768 / 1440px, cả hai theme.

## Cách triển khai

Hai phần, mỗi phần một nhánh và một migration riêng: `admin-votes` (1), `admin-ratings` (2). Không viết `trien-khai-*.md`. Chạy thử migration trong transaction rồi rollback trước khi đẩy lên DB thật.
