# Plan: Tối ưu tải trang và skeleton

## Context
Đo trên production (07/10/2026), mạng giả lập Slow 4G, CPU chậm 4 lần, khổ điện thoại:

| Chỉ số | Giá trị |
|---|---|
| Lần vẽ đầu tiên có nội dung (FCP) | 2,16 s |
| Phần nội dung lớn nhất hiện ra (LCP) | 2,72 s |
| Tải xong toàn trang | khoảng 6 s |
| Tổng dung lượng tải | 482 KB |
| JS ban đầu | khoảng 220 KB sau gzip |

Bundle không quá nặng. Vấn đề chính là cảm giác chờ:
- **Màn trắng:** khoảng 2,5 s đầu màn hình trống, rồi chỉ có một vòng xoay ở giữa, không có khung trang.
- **Request nối tiếp:** dữ liệu chỉ được gọi sau khi tải hết JS, rồi tải chunk của trang, rồi mở kết nối tới Supabase.
- **Nhấp nháy theo phiên đăng nhập:** phiên phải chờ thêm request lấy hồ sơ, nên trang hiện giao diện của khách trước, rồi mới đổi sang của người đã đăng nhập.
- **Skeleton lệch nội dung:** skeleton không khớp hình và số dòng, nên trang nhảy bố cục khi dữ liệu về.

Người dùng chọn làm **đợt 1 + 2** (chỉ frontend, không đổi database). **Đợt 3** để sau: route loader, sửa RPC trả thẳng thẻ truyện, chọn cột thay `select('*')`, ảnh thu nhỏ, tách vendor chunk.

**Trạng thái:** ✅ Xong đợt 1 + 2 (07/10/2026). Đợt 3 xong 08/10/2026, chi tiết và kết quả đo ở `plan-toi-uu-tai-trang-dot-3.md`.

Kết quả đo lại (cùng cách đo, bản build mới):
- **Khung trang:** hiện ngay từ 0,8 s (trước: màn trắng tới khoảng 2,5 s rồi vòng xoay, 4 s mới hiện trang).
- **Dữ liệu giả:** không còn trong bản build production.
- **JS vào trang:** giảm khoảng 12 KB sau gzip.
- **FCP/LCP:** gần như không đổi, vì skeleton không có chữ hay ảnh nên trình duyệt không tính là "nội dung". Muốn giảm hai số này cần đợt 3: tải dữ liệu song song với code của trang, bỏ các request nối tiếp.

## Đợt 1: thấy ngay
1. **Khung trang tĩnh trong `index.html`:** header + nền hiện ngay khi HTML và CSS về, trước khi JS chạy. Script inline sẵn có (đọc theme) đánh dấu thêm khi đang mở trang đọc chương, để khung không vẽ header ở đó. Sửa script này thì cập nhật hash CSP trong `vercel.json`.
2. **Fallback theo layout** thay cho `PageLoader` (vòng xoay toàn màn hình):
   - `MainLayout`: header thật + skeleton trang chung.
   - `ReaderLayout`: skeleton chương có màu nền theo cài đặt đọc.
   - `AuthLayout`: skeleton form.
3. **Thanh tiến trình mảnh** ở đầu trang khi đang chuyển trang (`useNavigation().state !== 'idle'`, hiện sau khoảng 150 ms để không nháy khi tải nhanh).
4. **`preconnect` tới Supabase** (lấy từ `VITE_SUPABASE_URL` lúc build) và **`preload` font chữ giao diện** (Be Vietnam Pro 400, bộ latin và vietnamese).
5. **Phiên đăng nhập trả ngay từ bản lưu trên máy** (phiên Supabase + hồ sơ đã lưu), hồ sơ làm mới ở nền. Bớt nhấp nháy giữa giao diện của khách và của người đã đăng nhập.
6. **Ảnh bìa:**
   - Prop `priority` cho ảnh banner và đầu trang truyện: tải ngay, `fetchPriority="high"`.
   - Mọi ảnh thêm `decoding="async"`.
   - Nền màu gradient theo slug hiện trong lúc chờ ảnh.
7. **Bỏ dữ liệu giả khỏi bản production:** chọn backend bằng hằng số lúc build, để code mock bị loại khi build.
8. **PWA:** đăng ký service worker trễ (sau khi trang tải xong, máy rảnh, thêm 3 s) để việc tải sẵn khoảng 2 MB không tranh băng thông với lần mở trang đầu. Vẫn tải sẵn đủ font (kể cả Literata): `pwa.config.test.ts` giữ quy tắc này để đọc offline đủ chữ tiếng Việt.
9. **Tiến độ đọc:** vẫn lưu trên máy mỗi giây, nhưng chỉ gửi lên server mỗi 15 s, khi rời trang/ẩn tab và khi đổi chương.

## Đợt 2: skeleton đúng hình và sửa lỗi
1. **Component `Skeleton` dùng chung:** có `motion-reduce:animate-none`; thay các `animate-pulse` viết tay.
2. **Chi tiết truyện:**
   - Skeleton đủ cả trang: đầu trang có hàng số liệu và nút, mô tả, danh sách chương, cột bên.
   - Phần đầu hiện ngay khi đi từ thẻ truyện: lấy thông tin truyện đã có trong cache của các danh sách.
3. **Số dòng skeleton khớp kích thước trang:**
   - Danh sách chương 50 → dùng `min(50, số chương)`.
   - Danh sách truyện 24, bảng xếp hạng, tìm kiếm 20.
   - Mới cập nhật 12, Top tuần, cột bên, bình luận.
   - Thanh phân trang có chỗ giữ sẵn.
4. **Trang chủ:**
   - Skeleton cho "Đọc tiếp" và "Thể loại".
   - `HeroSkeleton` có thêm hàng nút và dải ảnh nhỏ.
5. **Trang đọc:**
   - Thanh công cụ giữ nguyên khi sang chương mới; chỉ phần nội dung hiện skeleton, đúng bề rộng người đọc chọn.
   - Tải trước cả chương trước.
6. **Ô tìm kiếm và trang tìm kiếm:**
   - Gợi ý có skeleton khi đang chờ, làm mờ kết quả cũ.
   - Chỉ giữ kết quả cũ khi đổi trang, không giữ khi đổi từ khóa.
7. **Trang cần đăng nhập** (Tủ truyện, Tài khoản): skeleton theo hình trang thay vòng xoay toàn màn hình.
8. **Lỗi:**
   - Ô chấm điểm nhấp nháy mãi khi tải lỗi.
   - Khu Sáng tác báo "không tồn tại" khi lỗi mạng.
   - Trang tìm kiếm hiện số kết quả cũ khi đổi từ khóa.
   - Bảng quản trị hiện "Chưa có…" dưới vòng xoay lúc tải lần đầu.
   - Dashboard đổi kỳ không có dấu hiệu đang tải.
9. **Nút thiếu trạng thái đang lưu:**
   - Đổi trạng thái chương trong bảng chương.
   - Ẩn/công khai/gửi duyệt truyện.
   - Chấm điểm.

## Kiểm tra
- `npm run typecheck && npm run lint && npm test && npm run build`.
- So bundle trước/sau: bản build production không còn chunk dữ liệu giả.
- Đo lại trên Slow 4G với cùng cách đo (Playwright + CDP) cho trang chủ, chi tiết truyện, trang đọc. Ảnh chụp theo thời gian để trong `.playwright-mcp/`.
- Kiểm tra giao diện ở 375 / 768 / 1440px, cả hai theme.
