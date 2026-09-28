# Plan: Trang còn thiếu, lịch sử đọc & tính năng đọc mới

## Context
Web đã chạy trên production nhưng nhiều link trên menu, footer và trang chủ dẫn tới 404: tìm kiếm, danh sách truyện, bảng xếp hạng, tủ truyện, tài khoản, và 4 trang thông tin. Trang đọc cũng chưa lưu lịch sử và chưa có bình luận theo chương.

Người dùng đồng ý làm cả ba nhóm (25/09/2026):
1. **Trang còn thiếu**: tìm kiếm, danh sách (đang ra / hoàn thành / mới cập nhật), bảng xếp hạng, tủ truyện, tài khoản, giới thiệu / liên hệ / điều khoản / bảo mật.
2. **Hoàn thiện phần đọc**: lịch sử đọc + "Đọc tiếp" (nhớ chương và vị trí cuộn), bình luận theo chương.
3. **Tính năng mới**: báo chương mới cho truyện đang theo dõi, nghe truyện (đọc to), đọc cuộn liên tục, thống kê cho tác giả, báo lỗi chương.

Vẫn giữ quy tắc: component chỉ lấy dữ liệu qua `features/<x>/api.ts` + hook TanStack Query; dữ liệu giả lưu `localStorage`.

**Trạng thái:** ✅ Hoàn thành với dữ liệu giả (25/09/2026). Có 142 test pass, đã kiểm tra bằng Playwright ở 375px, 768px, 1440px và cả hai giao diện.

**Khác với plan:**
- Bảng xếp hạng: nhãn "Đánh giá cao" rút thành **"Điểm cao"** để 3 nút vừa màn 375px.
- Menu trang thông tin trên điện thoại cho xuống dòng thay vì cuộn ngang (cuộn ngang che mất mục đang chọn).
- **Lượt đọc:** mỗi người chỉ tính 1 lượt mỗi chương cho mỗi lần tải trang; lượt của chính tác giả không tính và cũng không bị ghi vào bộ chống đếm trùng.
- **Màu biểu đồ:** token `--chart-1` ở giao diện tối đổi `#ff3d8b` → `#f5347f`. Màu cũ nằm ngoài dải độ sáng của bộ kiểm màu biểu đồ; màu mới đạt cả độ sáng lẫn tương phản.
- Test tích hợp nâng `testTimeout` lên 10 giây (`vite.config.ts`). Luồng đăng truyện vốn mất khoảng 4,5 giây, nên khi 25 file chạy song song thì thỉnh thoảng vượt 5 giây.

---

## 1. Dữ liệu dùng chung

### 1.1 `src/mocks/activity.ts` (mới)
Gom mọi dữ liệu "hoạt động của người đọc" vào một chỗ, để nhiều api dùng chung mà không đọc thẳng key của nhau:

| Hàm | Key localStorage | Dùng ở |
|---|---|---|
| `loadFollows` / `saveFollows` | `mock-library` | library, studio (đếm người theo dõi), xếp hạng |
| `loadHistory` / `saveHistory` | `mock-history` | library |
| `loadViews` / `saveViews` | `mock-views` | chapters (ghi), stories (xếp hạng), studio (thống kê), catalog |
| `loadRatings` / `saveRatings` | `mock-ratings` | comments, catalog, studio |
| `loadUserComments` / `saveUserComments` | `mock-comments` | comments, studio |
| `loadReports` / `saveReports` | `mock-reports` | feedback, studio |

- **Theo dõi:** `mock-library` đổi từ `userId → slug[]` sang `userId → { slug, followedAt, seenChapter }[]`. Dữ liệu dạng cũ (chuỗi) vẫn đọc được.
- **Truyện người dùng đăng:** trước đây luôn có `viewCount = 0`, `ratingAvg = 0`. Giờ `catalog.toStory` tính lượt đọc và điểm từ dữ liệu thật đã ghi.

### 1.2 Kiểu dữ liệu
- `src/types/page.ts`: chuyển `Page<T>` ra khỏi `types/chapter.ts`.
- `src/types/library.ts`: `ReadingProgress`, `HistoryItem`, `LibraryItem`.
- `src/types/report.ts`: `ReportReason`, `ChapterReport`.
- `Comment` thêm `chapterNumber: number | null`. Bình luận cũ không có trường này được coi là bình luận của truyện.

---

## 2. Nhóm 1: Trang còn thiếu

### 2.1 Tìm kiếm `/search?q=&page=`
- **Cách tìm:** không phân biệt dấu (dùng `slugify`), khớp tên truyện hoặc tác giả.
  - Xếp hạng kết quả: tên bắt đầu bằng từ khóa > tên chứa từ khóa > tác giả khớp, rồi tới lượt đọc.
  - Có thêm các chip thể loại khớp từ khóa.
- **Trang kết quả:** ô tìm lớn, số kết quả, danh sách dạng dòng (`StoryRow`), 20 kết quả/trang.
  - Không có kết quả: gợi ý thể loại và Top tuần.
  - Chưa nhập từ khóa: hiện thể loại và truyện đọc nhiều.
- **Gợi ý nhanh ở header:** gõ từ 2 ký tự thì hiện tối đa 5 truyện (debounce 200ms) và dòng "Xem tất cả kết quả".
  - Theo mẫu combobox ARIA: phím ↑ ↓ chọn, Enter mở truyện, Esc đóng.
  - Ô trống thì vẫn gợi ý thể loại như cũ.
- Link tên tác giả ở trang chi tiết truyện dẫn về đây.

### 2.2 Danh sách `/list/:type`
- **Ba loại:** `latest`, `ongoing`, `completed`. Loại khác thì báo 404.
- **Bộ lọc** (giữ trên URL):
  - Thể loại (`genre`).
  - Độ dài (`length`: `short` < 50 chương, `medium` 50–200, `long` > 200).
  - Sắp xếp (`sort`: `updated` mặc định, `views`, `rating`, `newest`).
  - Trang (`page`).
- **Hiển thị:** lưới `StoryCard`, 24 truyện/trang.
- **Dùng lại:** component `StoryBrowser`. Trang `/genres/:slug` cũng dùng nó, với thể loại cố định và thêm bộ lọc trạng thái.
- "Mới cập nhật" ở trang chủ trỏ về `/list/latest`.
- **Phân trang:** tách từ `ChapterList` thành `components/common/Pagination.tsx` (dùng `Link` + `hrefFor`) để dùng chung.

### 2.3 Bảng xếp hạng `/ranking?by=&period=`
- **Tiêu chí:** Đọc nhiều (`views`, có kỳ `week` / `month` / `all`), Đánh giá cao (`rating`), Theo dõi nhiều (`follows`).
- **Top 50:** số thứ hạng lớn, top 3 tô màu; mỗi dòng có bìa, tên, tác giả, thể loại, chỉ số.
- **Dữ liệu giả:**
  - Lượt đọc tuần/tháng của truyện có sẵn sinh cố định theo slug (truyện mới cập nhật được cộng thêm), cộng lượt đọc thật đã ghi trong kỳ.
  - Điểm dùng trung bình Bayes (m = 50) để truyện ít lượt chấm không lên đầu.
  - Người theo dõi = số giả theo slug + lượt theo dõi thật.
- "Top tuần" ở trang chủ dùng chung số liệu tuần này (`getRanking`).

### 2.4 Tủ truyện `/library?tab=following|history`
- **Tab "Đang theo dõi"** (cần đăng nhập, chưa đăng nhập thì hiện lời mời):
  - Mỗi dòng có bìa, tên, "Đọc tới chương X/Y" hoặc "Chưa đọc", nhãn **"N chương mới"**, chương mới nhất và thời gian.
  - Nút: Đọc tiếp / Đọc, Bỏ theo dõi.
  - Truyện có chương mới xếp lên đầu.
- **Tab "Lịch sử đọc"** (khách cũng dùng được):
  - Mỗi dòng có chương đang đọc, % đã đọc, thời gian, nút Đọc tiếp và Xóa khỏi lịch sử.
  - Có nút "Xóa toàn bộ lịch sử" (hỏi lại trước khi xóa).

### 2.5 Tài khoản `/account` (bọc `RequireAuth`)
- **Hồ sơ:**
  - Ảnh đại diện: tải ảnh, cắt vuông 128px WebP. `prepareCover` tách thành `prepareImage`, dùng chung với bìa.
  - Tên hiển thị.
  - Email chỉ xem.
- **Đổi mật khẩu:** nhập mật khẩu hiện tại, mật khẩu mới, nhập lại. Tài khoản Google/Facebook thì chỉ hiện ghi chú.
- **Api:** `updateProfile`, `changePassword` ở `features/auth/api.ts`. Hook cập nhật cache phiên bằng `setQueryData`.
- **Bình luận:** tên và ảnh của người viết lấy lại từ hồ sơ khi đọc, nên đổi tên hay ảnh thì bình luận cũ cũng đổi theo. Ảnh không chép vào từng bình luận.

### 2.6 Trang thông tin
- `/about`, `/contact`, `/terms`, `/privacy` dùng khung chung `InfoPage`: tiêu đề, ngày cập nhật, nội dung dạng prose, menu chuyển giữa 4 trang.
- **Liên hệ:** form gồm họ tên, email, chủ đề, nội dung (zod), gửi qua `features/feedback/api.ts` (bản giả).
- **Điều khoản và Bảo mật:** nội dung mẫu cho nền tảng đọc/đăng truyện, ghi rõ bản thử nghiệm đang lưu dữ liệu trên trình duyệt.

---

## 3. Nhóm 2: Hoàn thiện phần đọc

### 3.1 Lịch sử đọc và "Đọc tiếp"
- **Ghi lịch sử:** mở chương thì ghi `{ slug, chapter, chapterTitle, progress, readAt }`.
  - Mỗi truyện một dòng; tối đa 100 truyện.
  - Vị trí cuộn lưu dạng tỉ lệ trong chương (0–1), ghi mỗi 1 giây khi cuộn và khi rời trang.
- **Khách chưa đăng nhập:** lịch sử lưu dưới khóa `guest`. Khi đăng nhập, lịch sử khách được gộp vào tài khoản.
- **Lượt đọc:** mở chương thì ghi 1 lượt (`recordChapterView`). Mỗi chương chỉ tính 1 lần cho mỗi lần tải trang. Lượt đọc được đếm theo chương và theo ngày.
- **Nơi hiển thị:**
  - Trang chủ: khối **"Đọc tiếp"** ngay dưới banner (chỉ khi có lịch sử), tối đa 4 truyện, có thanh %.
  - Trang chi tiết: nút chính thành **"Đọc tiếp chương N"**, nút phụ "Đọc từ đầu"; danh sách chương gắn nhãn "Đang đọc".
  - Tủ truyện, tab Lịch sử.
- **Mở lại vị trí:** link "Đọc tiếp" truyền `state: { resume: true }`. Trang đọc cuộn tới vị trí đã lưu (nếu > 3%) và hiện nhãn "Đã mở lại chỗ bạn đọc dở · Về đầu chương".

### 3.2 Bình luận theo chương
- **Api:**
  - `getComments(slug, { chapter, cursor })`: chapter = `null` là bình luận của truyện.
  - `addComment(slug, content, chapter?)`.
  - Query key `['comments', slug, chapter ?? 'story']`.
- **Dữ liệu giả:** truyện có sẵn có 0–6 bình luận mẫu mỗi chương, cố định theo slug + số chương.
- **Giao diện:** trang đọc có khối "Bình luận chương N" dưới thanh chuyển chương, dùng lại `CommentsSection` (tắt phần chấm sao). Trang chi tiết vẫn chỉ hiện bình luận của truyện.

---

## 4. Nhóm 3: Tính năng mới

### 4.1 Báo chương mới (tủ truyện)
- **Lưu khi theo dõi:** `seenChapter` = số chương mới nhất lúc bấm theo dõi. Mỗi lần đọc thì nâng lên `max(seenChapter, chương vừa đọc)`.
- **Số chương mới** = số chương đã xuất bản có số lớn hơn `seenChapter`.
- **Nơi hiện:**
  - Tủ truyện: nhãn trên từng truyện.
  - Header: chấm trên avatar và số trong menu "Tủ truyện" (`getLibraryUpdateCount`).
- Thực tế chỉ truyện người dùng đăng mới có chương mới (truyện có sẵn không đổi). Test: theo dõi truyện, tác giả xuất bản thêm chương, rồi kiểm tra nhãn.

### 4.2 Nghe truyện (Web Speech API)
- **Bật nghe:** nút **"Nghe"** trên thanh công cụ trang đọc (ẩn nếu trình duyệt không hỗ trợ). Bắt đầu từ đoạn đầu tiên đang thấy trên màn hình.
- **Thanh điều khiển nổi ở đáy:** đoạn trước, phát/tạm dừng, đoạn sau, tốc độ (0.75×–2×), tắt.
- **Khi đang đọc:** đoạn đang đọc được tô nền và tự cuộn vào giữa màn hình (tắt hiệu ứng khi bật giảm chuyển động).
- **Cách phát:**
  - Mỗi đoạn tách thành câu ≤ 220 ký tự, vì Chrome hay tự dừng khi câu đọc dài.
  - Tạm dừng = `cancel()` rồi nhớ đoạn đang đọc; phát lại thì bắt đầu từ đầu đoạn đó, vì `pause()` không ổn định trên Android.
  - Mỗi lượt phát có mã riêng để bỏ qua sự kiện `end` của lượt cũ.
- **Cài đặt** (nhóm "Nghe truyện" trong panel Cài đặt đọc): giọng đọc (ưu tiên `vi-*`, báo nếu máy không có giọng tiếng Việt), tự chuyển chương. Lưu ở Zustand key `reader-speech`.
- **Khi chuyển chương:** hết chương thì tự chuyển sang chương sau và đọc tiếp. Người dùng tự chuyển chương khác thì dừng đọc. Rời trang đọc thì `cancel()`.

### 4.3 Đọc cuộn liên tục
- **Bật tắt:** tùy chọn "Cuộn liên tục" trong Cài đặt đọc (`continuous`, mặc định tắt).
- **Nối chương:** khi còn khoảng 1,5 màn hình tới cuối chương thì tải và nối chương sau vào bên dưới. Giữa hai chương có dải "Hết chương N" và nút mở bình luận (thu gọn).
- **Đồng bộ URL:** chương đang ở giữa màn hình được coi là chương hiện tại. URL đổi theo bằng `navigate(..., { replace: true, preventScrollReset: true, state: { stream: true } })`. Thanh công cụ, tiêu đề tab, lịch sử và tiến độ đều theo chương hiện tại.
- **Chuyển kiểu điều hướng:** điều hướng không có `state.stream` (mục lục, phím ← →, link) thì bắt đầu chuỗi mới từ chương đó.

### 4.4 Thống kê cho tác giả
- **Tab "Thống kê"** ở trang quản lý truyện:
  - Ô số: lượt đọc tổng, 7 ngày qua, người theo dõi, đánh giá trung bình và số lượt, bình luận.
  - Biểu đồ cột lượt đọc 7 ngày.
  - Thanh lượt đọc theo từng chương.
- Danh sách Sáng tác thêm dòng "N lượt đọc · M theo dõi".
- Api `getStoryStats(storyId)` (kiểm tra chủ truyện).

### 4.5 Báo lỗi chương
- **Người đọc:** nút "Báo lỗi chương" ở cuối chương mở hộp thoại.
  - Lý do: Sai chính tả / Thiếu hoặc lặp nội dung / Sai thứ tự chương / Nội dung vi phạm / Khác.
  - Ghi chú ≤ 500 ký tự, bắt buộc khi chọn "Khác".
  - Cần đăng nhập.
- **Tác giả:** tab "Báo lỗi (N)" ở trang quản lý truyện liệt kê báo lỗi của truyện mình, có nút "Đã xử lý".
- **Truyện có sẵn:** báo lỗi được lưu lại, sau này ban quản trị xem.
- **Api:** `features/feedback/api.ts` gồm `reportChapter`, `getStoryReports`, `resolveReport`, `sendContactMessage`.

### 4.6 Tự động cuộn (bổ sung 28/09/2026, ✅ đã làm)
- **Bật:** nút **"Tự cuộn"** cạnh nút "Nghe" trên thanh công cụ trang đọc. Bấm lần nữa thì tạm dừng / chạy tiếp.
- **Thanh nổi ở đáy** (cùng khung `FloatingBar` với thanh nghe truyện): tạm dừng/cuộn tiếp, "Chương N · tự cuộn", tốc độ **− 1× +** (0.5×–3×), tắt.
- **Tốc độ:**
  - 1× là đọc kịp 220 chữ/phút (cùng mốc với "khoảng N phút đọc").
  - Số px mỗi chữ đo từ bố cục thật của chương (chiều cao các đoạn chia số chữ), đo lại mỗi giây, nên tự theo cỡ chữ, giãn dòng, độ rộng màn hình.
  - Tốc độ được nhớ ở Zustand key `reader-autoscroll`.
- **Cách cuộn:** `requestAnimationFrame` với vị trí đích dạng số thực và `scrollTo({ behavior: 'instant' })`.
  - Người đọc tự cuộn (lăn chuột, phím) thì đi tiếp từ chỗ mới.
  - Đang chạm tay trên màn hình, hoặc đang mở mục lục / cài đặt / hộp thoại, thì đứng yên.
- **Thanh công cụ:** bắt đầu tự cuộn thì ẩn đi. Trong lúc tự cuộn, thanh chỉ ẩn/hiện khi chạm vào chữ, không tự ẩn theo cuộn (`useAutoHideToolbar(frozen)`).
- **Hết chương:**
  - Từng chương: đoạn cuối lên tới trên thanh nổi thì dừng, thanh hiện "Hết chương N · [Chương sau]". Bấm là sang chương sau và cuộn tiếp từ đầu chương.
  - Cuộn liên tục: chạm đáy trang mà chương sau chưa nối vào thì đứng chờ. Hết hẳn chuỗi chương (`[data-stream-end]`) thì dừng, báo "Đã tới chương mới nhất".
- **Chuyển chương cách khác** (mục lục, phím ← →, link) khi đang tự cuộn thì tạm dừng.
- **Không chạy cùng nghe truyện:** bật cái này thì tắt cái kia.

---

## 5. Khi nối Supabase (ghi chú)
- **Bảng mới:**
  - `follows` (user_id, story_id, followed_at, seen_chapter).
  - `reading_history` (user_id, story_id, chapter_number, progress, read_at).
  - `chapter_views` (story_id, chapter_number, day, count). Đếm bằng RPC `increment_view`.
  - `chapter_reports` (id, story_id, chapter_number, reporter_id, reason, note, status, created_at).
  - `contact_messages`.
- **Bình luận:** `comments.chapter_number` nullable.
- **Lịch sử của khách** vẫn lưu `localStorage` trong `api.ts`, gộp lên máy chủ khi đăng nhập.
- **Tìm kiếm:** Postgres full-text + `unaccent`.
- **Xếp hạng:** view/materialized view theo kỳ.
- **RLS:**
  - Theo dõi và lịch sử: chỉ chủ sở hữu.
  - Báo lỗi: người gửi `insert`, chủ truyện `select` và `update` trạng thái.
  - Thống kê: chủ truyện.

---

## 6. Kiểm tra
- **Test hàm thuần:**
  - Tách/ghép tham số bộ lọc trên URL.
  - Tách câu cho giọng đọc.
  - Tìm kiếm không dấu và thứ tự kết quả.
  - Số chương mới.
  - Gộp lịch sử của khách.
- **Test api:**
  - Tìm kiếm, lọc, xếp hạng.
  - Theo dõi → tác giả thêm chương → có "1 chương mới", đọc xong thì hết.
  - Bình luận theo chương tách riêng với bình luận của truyện.
  - Báo lỗi: chỉ chủ truyện xem được.
  - Thống kê đếm đúng lượt đọc.
- **Test luồng (`renderApp`):**
  - Tìm từ header → trang kết quả.
  - Mọi link trên menu và footer không còn 404.
  - Đọc chương → trang chủ có "Đọc tiếp" → bấm thì mở lại đúng chương.
  - Tủ truyện, tài khoản (đổi tên, đổi mật khẩu).
  - Bình luận chương.
  - Báo lỗi → tác giả thấy trong tab.
  - Nghe truyện với `speechSynthesis` giả.
  - Tự động cuộn với `requestAnimationFrame`/`scrollTo` giả: trôi xuống, đổi tốc độ, tạm dừng, hết chương rồi "Chương sau", tự chuyển chương thì tạm dừng, không chạy cùng nghe truyện.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` sạch.
- **Playwright:** 375px, 768px, 1440px, cả hai theme. Kiểm tra không cuộn ngang, trang đọc ở cả hai chế độ, thanh nghe truyện.
