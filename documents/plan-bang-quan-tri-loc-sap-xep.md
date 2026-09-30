# Plan: Lọc, sắp xếp, phân trang cho bảng quản trị và sửa giao diện bảng

Trạng thái: đang làm (30/09/2026). Nhánh `admin-table-filters-sort`.

## Context

Các bảng trong `/admin` mới chỉ có ô tìm hoặc một bộ lọc, thứ tự cố định, 20 dòng mỗi trang không đổi được. Rà giao diện ở 1440 / 768 / 375px với dữ liệu thử (47 người dùng, 26 truyện, 64 bình luận) thấy thêm lỗi hiển thị của bảng.

## 1. Lỗi giao diện cần sửa

- Cột thao tác bị khuất ở 1440px: bảng Truyện phải cuộn ngang mới thấy nút Gỡ / Khôi phục; ở Người dùng, Hộp thư, Báo lỗi, Bình luận nút cuối bị cắt ở mép phải.
- Chữ đè sang cột bên cạnh: nhãn lý do và tên người báo (Báo lỗi), tên người viết (Bình luận). Nguyên nhân: cột `whitespace-nowrap` không có độ rộng trong bảng `table-layout: fixed`.
- Tiêu đề cột bị cắt ở Người dùng ("Đăng nhập bằng", "Đăng nhập cuối").
- Phân trang không đổi được số dòng, không ghi đang xem dòng nào.

Cách sửa: mọi cột có độ rộng; tên dài cắt bằng "…" (`ellipsis`, rê chuột xem đủ); cột thao tác ghim bên phải từ màn `lg`; cột đầu vẫn ghim bên trái từ màn `md`.

## 2. Lọc, sắp xếp, phân trang

| Bảng | Lọc | Sắp xếp |
|---|---|---|
| Người dùng | `q`, `role` (`admin` \| `member`), `status` (`active` \| `banned`), `provider` | `name`, `created` (mặc định, giảm), `lastSignIn`, `stories`, `comments`, `follows` |
| Truyện | `q`, `owner`, `visibility` (`published` \| `draft` \| `takedown`), `status` (`ongoing` \| `completed`), `reports=open` | `title`, `chapters`, `views`, `followers`, `rating`, `comments`, `reports`, `created`, `updated` (mặc định, giảm) |
| Hộp thư | `status`, `topic`, `q` (tên, email, nội dung) | lúc gửi (`order`) |
| Báo lỗi | `status`, `reason`, `q` (tên truyện, ghi chú, người báo) | lúc báo (`order`) |
| Bình luận | `view`, `q`, `kind` (`root` \| `reply`) | `created`, `reported` |
| Thể loại (lọc ở client) | ô tìm, nguồn (có sẵn / người dùng tạo) | tên, số truyện, ngày tạo |
| Top truyện ở Tổng quan | – | các cột số (10 dòng, sắp ở client) |

- **URL:** `?sort=<cột>&order=asc|desc&size=10|20|50|100` cùng các tham số lọc ở bảng trên. Giá trị lạ coi như mặc định. Đổi bộ lọc, cột sắp xếp hay số dòng thì về trang 1.
- **Sắp xếp:** bấm tiêu đề cột: giảm dần → tăng dần → về mặc định. Ô chọn sắp xếp của bảng Truyện được thay bằng cách này (link cũ `?sort=views` vẫn đúng).
- **Phân trang:** chọn 10 / 20 / 50 / 100 dòng, ghi "1–20 trong 47".
- **Nút "Xóa bộ lọc"** hiện khi đang lọc hoặc tìm.

## 3. Dữ liệu

- Kiểu truy vấn trong `features/admin/shared.ts` thêm các trường lọc, `sort`, `order`, `pageSize`. `adminPageSize()` chỉ nhận 10 / 20 / 50 / 100.
- **Bản remote:** PostgREST lọc, sắp xếp và phân trang được ngay trên kết quả của RPC trả bảng, nên Người dùng, Truyện, Bình luận không đổi RPC: thêm `.eq()` / `.order()` sau `rpc(...)`. Mọi truy vấn thêm `.order('id')` làm khóa phụ để phân trang ổn định.
- **Migration `admin_inbox_reports_search`:** `admin_contact_messages` và `admin_reports` thêm `p_query` (tìm không dấu bằng `slugify`, như các ô tìm khác). Tham số mới có mặc định nên bản app cũ vẫn gọi được.
- **Bản giả:** lọc và sắp xếp cùng quy tắc trong `api.mock.ts`.

## 4. Giao diện

- `features/admin/components/useFilterParams.ts`: đọc thêm `size`, `sort`, `order`.
- `features/admin/components/adminTable.tsx`: phần dùng chung của các bảng (cấu hình phân trang, thuộc tính sắp xếp của cột, xử lý `onChange` của bảng, ô lọc `FilterSelect`).
- Sáu trang bảng trong `pages/admin` dùng các phần trên.

## 5. Kiểm tra

- Test api bản giả cho từng bộ lọc, cột sắp xếp và `pageSize` của năm bảng.
- Test luồng: bấm tiêu đề cột đổi thứ tự và URL; chọn bộ lọc; đổi số dòng; "Xóa bộ lọc".
- `supabase/checks/rls_and_rules.sql`: `p_query` của hai RPC, người thường vẫn bị chặn.
- Gọi thử API thật bằng tài khoản không phải admin để chắc cú pháp lọc, sắp xếp trên RPC được PostgREST nhận.
- Chụp lại 9 trang admin ở 1440 / 768 / 375px, hai theme, với dữ liệu thử.
