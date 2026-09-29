# Plan: Trang quản trị `/admin`

Trạng thái: ✅ xong (28/09/2026). Phần thao tác (hộp thư, báo lỗi, khóa user, gỡ truyện, thể loại, nhập truyện hàng loạt) ở `plan-cong-cu-admin.md`.

## Mục tiêu

Quản trị viên xem được tình hình của web ở một chỗ: số liệu tổng quan kèm biểu đồ, danh sách người dùng, danh sách truyện (kể cả bản nháp). **Chỉ xem**, không khóa tài khoản, không sửa/xóa nội dung. Các việc đó vẫn làm qua Supabase Dashboard.

## Thư viện

- **Ant Design** (`antd` v6) cho khung trang, bảng, ô số liệu; biểu đồ bằng `@ant-design/plots` (G2).
- Chỉ dùng trong `/admin`. Route lazy-load nên antd và G2 nằm ở chunk riêng, không có trong các trang đọc truyện.
- Theme antd lấy màu từ token của web (`features/admin/components/adminTheme.ts`), đổi sáng/tối theo `useTheme`.
- Style của antd không nằm trong `@layer` nên thắng class Tailwind cùng thuộc tính (vd `.ant-layout` có `min-height: 0`). Muốn đè thì dùng `style` hoặc class có `!`.

## Quyền

- Quản trị viên = `auth.users.raw_app_meta_data.role = 'admin'`. `User.isAdmin` đọc từ `session.user.app_metadata.role`.
- Cách cấp và thu hồi quyền: mục 10 `thiet-ke-database.md`.
- Bản giả: tài khoản demo (`demo@webtruyen.vn`) là quản trị viên (`src/mocks/users.ts`).
- `pages/admin/AdminShell`: chưa đăng nhập thì chuyển sang đăng nhập; đăng nhập mà không phải quản trị viên thì hiện trang 404 (không để lộ là có trang quản trị).
- Menu tài khoản có mục "Quản trị" chỉ khi `user.isAdmin`.

## Route

| Đường dẫn | Trang | Tham số URL |
|---|---|---|
| `/admin` | Tổng quan | `?period=7\|90` (mặc định 30 ngày) |
| `/admin/users` | Người dùng | `?q=`, `?page=` |
| `/admin/stories` | Truyện | `?q=`, `?visibility=published\|draft`, `?sort=views\|created`, `?owner=<id>`, `?page=` |

## Nội dung từng trang

- **Tổng quan:**
  - 6 ô số: người dùng (+ mới trong kỳ), truyện công khai (+ bản nháp), chương đã xuất bản, lượt đọc (+ trong kỳ), bình luận, báo lỗi đang mở.
  - 4 biểu đồ: người dùng mới theo ngày (cột), lượt đọc theo ngày (đường), chương mới/truyện mới theo ngày (cột, có nút đổi), truyện công khai theo thể loại (thanh ngang, top 10).
  - Bảng top 10 truyện nhiều lượt đọc.
- **Người dùng:** bảng tên, email, cách đăng nhập, vai trò, ngày tham gia, lần đăng nhập cuối, số truyện (bấm để xem truyện của người đó), bình luận, theo dõi.
- **Truyện:** bảng tên (link trang truyện nếu công khai), tác giả, hiển thị, tiến độ, chương đã xuất bản/tổng, lượt đọc, theo dõi, đánh giá, bình luận, báo lỗi mở, ngày cập nhật.

Biểu đồ:
- Đều chỉ có một chuỗi số liệu, màu `--chart-1`, đã kiểm bằng validator của skill dataviz ở cả hai theme.
- Mỗi thẻ biểu đồ có nút xem dạng bảng.
- Kỳ không có số liệu thì hiện trạng thái rỗng.
- Trục số đếm chỉ ghi số nguyên.

## Dữ liệu

- `features/admin/` theo mẫu 4 file: `getAdminOverview(days)`, `getAdminUsers({ q, page })`, `getAdminStories({ q, visibility, ownerId, sort, page })`. Người không phải quản trị viên nhận `AdminError`.
- Bản Supabase: RPC `admin_overview`, `admin_users`, `admin_stories` (migration `admin_dashboard`). Phần chạy quyền cao nằm ở `private`, lớp vỏ `security invoker` ở `public`. Bảng tra ở mục 6 và 8 `thiet-ke-database.md`.
- Bản giả gộp truyện có sẵn (tác giả "Hệ thống") với truyện người dùng. Người dùng lấy từ `src/mocks/users.ts`, kho chung với auth giả.

## Kiểm tra

- `src/features/admin/api.test.ts`: phân quyền, số liệu, lọc.
- `src/features/admin/admin-flow.test.tsx`: chuyển hướng khách, 404 cho người thường, luồng của quản trị viên. G2 cần canvas nên test thay `@ant-design/plots` bằng thẻ rỗng.
- `supabase/checks/rls_and_rules.sql` có ca cho khách (`42501`), người thường (`forbidden`) và quản trị viên.

## Có thể làm sau

- Thao tác quản trị: khóa tài khoản (`banned_until`), gỡ truyện vi phạm, xử lý báo lỗi, quản lý thể loại và `curated_stories`.
