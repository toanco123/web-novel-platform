# Plan: Trang chi tiết truyện `/truyen/:slug`

## Context
Trang chủ và đăng nhập/đăng ký đã xong, nhưng bấm vào bất kỳ truyện nào cũng ra 404. Bước này làm **trang chi tiết truyện**. Đây là trang người đọc xem trước khi bắt đầu đọc, và cũng là trang Google hay đánh chỉ mục nhất.

Đã chốt với người dùng:
- **Bố cục:** một trang cuộn (Giới thiệu → Danh sách chương → Bình luận), có thanh mục lục nhỏ để nhảy nhanh.
- **Bình luận và chấm sao:** làm đầy đủ bằng dữ liệu giả (xem, viết, xóa bình luận của mình, chấm 1–5 sao khi đã đăng nhập).
- **Tủ truyện:** "Thêm vào tủ truyện" lưu thật theo tài khoản (dữ liệu giả). Nút ở banner trang chủ cũng dùng chung logic này.

Vẫn giữ quy tắc của dự án: component chỉ lấy dữ liệu qua `features/<x>/api.ts` và hook TanStack Query; dữ liệu giả lưu `localStorage` giống auth giả.
**Trạng thái:** ✅ Hoàn thành với dữ liệu giả (25/09/2026).

Khác với plan:
- Phân trang tự viết bằng `Link` (nhãn tiếng Việt) thay cho `ui/pagination` của shadcn (gắn cứng `<a>` và nhãn tiếng Anh).
- Nút sắp xếp là 2 nút "Cũ nhất / Mới nhất" cạnh nhau thay vì 1 nút bật tắt.
- Thêm `AppScrollRestoration`: sửa lỗi mở URL mới trong cùng tab bị cuộn sẵn tới vị trí của trang trước.

---

## 1. Bố cục

```
Desktop
┌────────────────────────────────────────────────────────────────┐
│ Header (MainLayout)                                            │
├────────────────────────────────────────────────────────────────┤
│ Trang chủ / Ngôn tình / Trường An Không Tuyết   (breadcrumb)   │
│ ┌─────────┐  Ngôn tình  Cổ đại  Cung đấu                       │
│ │         │  Trường An Không Tuyết              (h1, serif)    │
│ │  Bìa    │  của Diệp Thanh Y                                  │
│ │  w-60   │  ★ 4.8 (12,4 N)  👁 3,8 Tr  📖 412 chương  Đang ra │
│ │         │  Cập nhật 24 phút trước                            │
│ └─────────┘  [Đọc từ chương 1] [Chương mới nhất] [+ Tủ truyện] │
│   (nền: dải màu bìa + quầng neon, giống banner trang chủ)      │
├────────────────────────────────────────────────────────────────┤
│ [Giới thiệu] [Danh sách chương 412] [Bình luận 38]  ← dính khi │
│                                                       cuộn    │
│ ┌──────────────────────────────────────┐ ┌──────────────────┐ │
│ │ Giới thiệu                           │ │ Cùng tác giả     │ │
│ │ mô tả (thu gọn 6 dòng, "Xem thêm")   │ │ (danh sách nhỏ)  │ │
│ │                                      │ │                  │ │
│ │ Danh sách chương   [Cũ ↔ Mới] [Đi tới│ │ Cùng thể loại    │ │
│ │ chương: __ ]                         │ │ (danh sách nhỏ)  │ │
│ │ Chương 1: ...        Chương 2: ...   │ └──────────────────┘ │
│ │ ... (50 chương/trang, 2 cột)         │                      │
│ │ ‹ 1 2 3 … 9 ›                        │                      │
│ │                                      │                      │
│ │ Bình luận & đánh giá                 │                      │
│ │ 4.8 ★★★★★  thanh phân bố 5→1 sao     │                      │
│ │ Đánh giá của bạn: ☆☆☆☆☆              │                      │
│ │ [ô viết bình luận]      [Gửi]        │                      │
│ │ danh sách bình luận … [Xem thêm]     │                      │
│ └──────────────────────────────────────┘                      │
└────────────────────────────────────────────────────────────────┘
```

- **Mobile (375px):**
  - Banner: bìa `w-28` bên trái, tên truyện và tác giả bên phải; thông số và các nút xuống dòng dưới, nút rộng hết khung.
  - Thanh mục lục cuộn ngang được.
  - Danh sách chương còn 1 cột.
  - Cột "Cùng tác giả / Cùng thể loại" chuyển xuống dưới cùng.
- **Tablet (768px):** banner vẫn 2 cột; danh sách chương 2 cột; cột phụ xuống dưới, xếp 2 khối cạnh nhau.
- **Banner:** dùng lại cách tô nền của `HeroShowcase` (`coverPalette(slug)` + quầng hồng neon), chữ luôn sáng như banner trang chủ.
- **Thanh mục lục:** `sticky` ngay dưới header (`top-16`, trên `lg` là `top-28` vì header có 2 tầng). Mỗi mục là link `#gioi-thieu`, `#danh-sach-chuong`, `#binh-luan`, các section có `scroll-mt` để không bị header che. Mục đang xem được tô sáng nhờ `IntersectionObserver`.

## 2. Chi tiết từng phần

**Banner / thông tin chính**
- Breadcrumb: Trang chủ / thể loại đầu tiên / tên truyện (`nav aria-label="Breadcrumb"`).
- `h1` là tên truyện; tác giả tạm link tới `paths.search(tên tác giả)`.
- Thông số dạng `<dl>`: đánh giá, lượt xem, số chương, trạng thái, thời gian cập nhật (`formatRelativeTime`).
- Các nút:
  - "Đọc từ chương 1" → `paths.chapter(slug, 1)`.
  - "Chương mới nhất" → chương `latestChapter`. Nút "Đọc tiếp" sẽ thêm khi có lịch sử đọc.
  - `FollowButton` ("Thêm vào tủ truyện" / "Đã thêm vào tủ truyện").

**Giới thiệu:** mô tả truyện, quá 6 dòng thì thu gọn, nút "Xem thêm" / "Thu gọn" (`aria-expanded`). Bên dưới là các thẻ thể loại.

**Danh sách chương**
- 50 chương/trang, trang và thứ tự nằm trên URL (`?trang=2&sap-xep=moi`) để chia sẻ được và nút Back hoạt động.
- Đổi thứ tự "Cũ nhất / Mới nhất" (nút bật tắt, `aria-pressed`).
- Ô "Đi tới chương" (số từ 1 tới `chapterCount`, báo lỗi nếu ngoài khoảng) → mở thẳng chương đó.
- Mỗi dòng: "Chương n: tiêu đề" + ngày đăng; chương mới nhất có nhãn "Mới".
- Phân trang bằng `ui/pagination` (có "…" khi nhiều trang). Đổi trang thì cuộn về đầu mục danh sách chương.
- Khung chờ (skeleton) khi đang tải; giữ dữ liệu trang cũ trong lúc tải trang mới (`placeholderData: keepPreviousData`).

**Bình luận & đánh giá**
- **Tổng quan:** điểm trung bình cỡ lớn, số lượt, 5 thanh phân bố 5→1 sao.
- **"Đánh giá của bạn":** 5 ngôi sao bấm được (bàn phím dùng được, dạng radio group). Chưa đăng nhập thì hiện "Đăng nhập để chấm điểm" dẫn tới `paths.login(trang hiện tại)`.
- **Ô viết bình luận:** tối đa 1000 ký tự, có bộ đếm, không cho gửi khi trống; react-hook-form + zod. Chưa đăng nhập thì thay bằng lời mời đăng nhập.
- **Danh sách bình luận:** avatar (`UserAvatar`), tên, thời gian, nội dung; mới nhất trước; mỗi lần 10 bình luận, nút "Xem thêm bình luận" (`useInfiniteQuery`).
- Bình luận của chính mình có nút "Xóa", hỏi xác nhận bằng `ui/dialog`.
- Bình luận mới hiện ngay sau khi gửi.
- Phạm vi: chưa có trả lời bình luận (reply) và báo cáo vi phạm, để làm sau.

**Cột phụ:** "Cùng tác giả" (loại trừ truyện đang xem, ẩn khối nếu không có) và "Cùng thể loại" (xếp theo số thể loại trùng, rồi theo lượt xem, tối đa 6). Mỗi truyện hiển thị như danh sách Top tuần: bìa nhỏ (`compact`), tên, lượt đọc.

**Trạng thái đặc biệt**
- Slug không tồn tại: hiện nội dung 404 ngay trong trang. Nội dung này được tách thành component `NotFound` dùng chung, `NotFoundPage` gọi lại nó.
- Lỗi tải dữ liệu: dùng `SectionError` đã có.

**SEO:** `<title>{tên truyện} - {tác giả} | {SITE_NAME}</title>`, `<meta name="description">` lấy khoảng 155 ký tự đầu của mô tả.

## 3. Dữ liệu (api + mock)

**Kiểu mới** (`src/types/`):
- `ChapterSummary { number, title, createdAt }`
- `Page<T> { items, total, page, pageCount }`
- `Comment { id, storySlug, user: { id, displayName, avatarUrl }, content, createdAt }`
- `RatingSummary { average, count, distribution: Record<1..5, number> }`

**`features/stories/api.ts`** (thêm):
- `getStory(slug)`: trả về `null` nếu không có.
- `getStoriesByAuthor(authorSlug, excludeSlug)`.
- `getRelatedStories(slug, limit)`.

**`features/chapters/api.ts` + `hooks.ts`** (mới):
- `getChapterList(slug, { page, order })`.
- Mock `src/mocks/chapters.ts` sinh tên chương cố định theo slug, từ một kho tên chương. Chương cuối lấy đúng `latestChapter.title`; ngày đăng lùi dần từ `updatedAt`.

**`features/library/api.ts` + `hooks.ts`** (mới):
- `getFollowStatus(slug)`, `followStory(slug)`, `unfollowStory(slug)`.
- Lưu theo user ở `localStorage` key `mock-library` (`{ [userId]: slug[] }`); user lấy từ `getSession()` của auth api.
- Hook `useFollowStatus(slug)` có key `['library', userId, slug]`.
- `useToggleFollow(slug)` cập nhật giao diện ngay (optimistic), lỗi thì trả lại trạng thái cũ.

**`features/comments/api.ts` + `hooks.ts`** (mới):
- `getComments(slug, cursor)`, `addComment(slug, content)`, `deleteComment(id)`, `getRatingSummary(slug)`, `getMyRating(slug)`, `rateStory(slug, score)`.
- Mock seed ~15 bình luận mẫu tiếng Việt cho vài truyện nổi bật (`src/mocks/comments.ts`). Bình luận và điểm người dùng thêm vào được lưu `localStorage` (`mock-comments`, `mock-ratings`).
- Điểm tổng hợp = số liệu gốc của truyện (`ratingAvg`, `ratingCount`, phân bố suy ra từ điểm trung bình) + điểm người dùng đã chấm.
- Chưa đăng nhập mà gọi hàm ghi thì ném `AuthError` (cần đăng nhập).

**Khóa cache:** mọi key có `userId` (thư viện, điểm của tôi) sẽ đổi theo khi đăng nhập hoặc đăng xuất, nên không bị lẫn dữ liệu giữa hai tài khoản.

## 4. File cần tạo / sửa

**Tạo mới**
- **Trang:** `src/pages/StoryDetailPage.tsx` (default export; đọc `:slug`, `?trang`, `?sap-xep`).
- **Các khối trang chi tiết** trong `src/features/stories/detail/`: `StoryHero`, `Breadcrumb`, `SectionNav`, `StoryDescription`, `SideStoryList`, `StoryDetailSkeleton`.
- **Chương** trong `src/features/chapters/`: `api.ts`, `hooks.ts`, `components/ChapterList.tsx`, `components/JumpToChapter.tsx`.
- **Tủ truyện** trong `src/features/library/`: `api.ts`, `hooks.ts`, `components/FollowButton.tsx` (có biến thể `onDark` cho banner).
- **Bình luận** trong `src/features/comments/`: `api.ts`, `hooks.ts`, `schemas.ts`, và các component `CommentsSection`, `RatingSummary`, `StarRatingInput`, `CommentForm`, `CommentItem`, `DeleteCommentDialog`.
- **Dùng chung:** `src/components/common/NotFound.tsx`, `src/hooks/useActiveSection.ts` (IntersectionObserver cho thanh mục lục).
- **Mock và kiểu dữ liệu:** `src/mocks/chapters.ts`, `src/mocks/comments.ts`, `src/types/chapter.ts`, `src/types/comment.ts`.

**Sửa**
- `src/app/router.tsx`: thêm `{ path: 'truyen/:slug', lazy: page(...) }` trong `MainLayout`.
- `src/features/stories/api.ts` + `hooks.ts`: thêm `getStory`, `getStoriesByAuthor`, `getRelatedStories` và hook tương ứng.
- `src/features/stories/sections/HeroShowcase.tsx`: bỏ state `saved` cục bộ, dùng `FollowButton` (giữ nguyên việc chuyển sang đăng nhập khi chưa đăng nhập, logic này chuyển vào `FollowButton`).
- `src/pages/NotFoundPage.tsx`: dùng component `NotFound`.

**Dùng lại:**
- **Truyện:** `StoryCover` (có `compact`), `coverPalette`, `SectionHeading`, `SectionError`, `Container`.
- **Tiện ích:** `formatCount`, `formatRelativeTime`, `paths`, `cn`.
- **Auth:** `useSession`, `UserAvatar`, `FormAlert`, `SubmitButton`, `AuthError`.
- **shadcn:** `Button`, `Pagination`, `Dialog`, `Textarea`.
- **Kiểu dáng:** hàng danh sách giống `TrendingWeekly`; tô nền banner giống `HeroShowcase`.

## 5. Kiểm tra
- **Test tự động** (`npm test`):
  - `chapters/api.test.ts`: trang 1 có 50 chương, trang cuối đúng số dư, đảo thứ tự đúng, chương cuối trùng `latestChapter`.
  - `comments/api.test.ts`: điểm trung bình thay đổi đúng khi chấm; chưa đăng nhập thì không ghi được.
  - `story-detail.test.tsx` (qua `renderApp`):
    - Mở `/truyen/truong-an-khong-tuyet` thấy `h1` tên truyện và "Chương 1".
    - Bấm trang 2 thì URL có `?trang=2` và thấy "Chương 51"; đổi "Mới nhất" thì chương đầu là 412.
    - "Đi tới chương" 500 thì báo lỗi ngoài khoảng.
    - Chưa đăng nhập bấm "Thêm vào tủ truyện" thì sang `/dang-nhap?next=...`. Đã đăng nhập bấm thì thành "Đã thêm vào tủ truyện", render lại vẫn giữ.
    - Đăng nhập rồi gửi bình luận thì bình luận hiện đầu danh sách; xóa thì biến mất.
    - Slug sai thì hiện nội dung 404.
- `npm run build`, `npm run lint` sạch.
- **Kiểm tra bằng Playwright** ở 375px, 768px, 1440px, cả giao diện tối và sáng:
  - Không cuộn ngang; thanh mục lục dính đúng dưới header và tô sáng đúng mục.
  - Đi hết luồng: trang chủ → bấm một truyện → đổi trang chương → thêm vào tủ → bình luận → chấm sao.
