# Plan: Duyệt truyện trước khi công khai

Trạng thái: ✅ xong (01/10/2026). Nhánh `story-review`, kế hoạch triển khai ở `trien-khai-duyet-truyen.md`.

Khác với plan:
- Trang truyện chưa công khai: không thêm dải mới mà sửa câu của dải "bản nháp" có sẵn trong `StoryHero` (chủ truyện: "Truyện chưa công khai, chỉ bạn thấy…"; quản trị viên xem truyện chờ duyệt: "Truyện đang chờ duyệt, chỉ tác giả và ban quản trị thấy…").
- Bảng Truyện: trạng thái duyệt là ô lọc riêng "Duyệt" (`?review=pending|rejected`) thay vì thêm vào nhóm nút "Hiển thị" (6 nút làm tràn ngang màn 375px).
- Tổng quan: thêm ô "Truyện chờ duyệt" thành 9 ô nên lưới đổi sang 3 ô mỗi hàng từ màn `md`.
- Quản trị viên chỉ đọc thẳng được truyện đang chờ duyệt; truyện bị từ chối chỉ thấy qua `admin_stories` (hàng chờ, tab "Bị từ chối").

## Context

Hiện tác giả bấm "Xuất bản truyện" (hoặc "Đăng truyện" ở form tạo truyện) là truyện công khai ngay: `plan-sang-tac-va-the-loai.md` đã chốt "không cần admin". Quản trị viên chỉ gỡ được truyện sau khi truyện đã lên. Người dùng muốn kiểm soát quyền đăng công khai: truyện của tác giả phải được quản trị viên duyệt mới công khai, chưa duyệt thì chỉ tác giả thấy (trong khu Sáng tác, như bản nháp hiện nay).

## Đã chốt (01/10/2026)

- **Phạm vi:** chỉ duyệt truyện, ở lần đầu truyện lên công khai. Chương mới của truyện đã duyệt xuất bản là hiện ngay; vi phạm thì quản trị viên gỡ như hiện nay.
- **Duyệt một lần là đủ:** truyện đã duyệt thì tác giả tự ẩn/hiện, sửa tên, mô tả, bìa mà không phải duyệt lại. Bị gỡ thì mất dấu đã duyệt; khôi phục xong tác giả phải gửi duyệt lại.
- **Từ chối:** bắt buộc ghi lý do (tác giả đọc được). Tác giả sửa rồi gửi duyệt lại, không giới hạn số lần.
- **Miễn duyệt:** chỉ quản trị viên (truyện tự đăng và nhập hàng loạt công khai ngay).
- **Báo kết quả:** trạng thái hiện trong khu Sáng tác; không có thông báo hay email.
- **Lưu:** cột trên bảng `stories`, theo kiểu cột gỡ truyện (`taken_down_at`, `takedown_reason`). Không thêm giá trị vào enum `publication_status`, không có bảng lịch sử duyệt.

Ngoài phạm vi: duyệt chương, "tác giả tin cậy", lịch sử các lần duyệt, thông báo/email, tác giả rút lại yêu cầu duyệt (vẫn xóa truyện được).

## 1. Trạng thái duyệt

`visibility` giữ hai giá trị `draft` / `published`. Thêm trạng thái duyệt `review`:

| `review.status` | Ai thấy truyện | Tác giả làm được |
|---|---|---|
| `null` (chưa gửi) | Chỉ tác giả | "Gửi duyệt" khi có ≥ 1 chương đã xuất bản và truyện không bị gỡ |
| `pending` | Tác giả + quản trị viên (để đọc duyệt) | Sửa truyện, thêm/sửa/xuất bản chương bình thường |
| `rejected` | Chỉ tác giả, kèm lý do | Sửa rồi "Gửi duyệt lại" |
| `approved` | Như hiện nay (`visibility` quyết định) | Tự xuất bản / ẩn, sửa tùy ý |

Truyện có sẵn của bản giả (truyện "hệ thống") luôn coi là đã duyệt.

## 2. Luật

- **Gửi duyệt** (`submitStoryForReview(id)`): chỉ chủ truyện (truyện người khác → `not_found`). Lỗi: `already_pending`, `already_approved`, `no_published_chapters`, `story_taken_down`. Thành công: `pending`, ghi `submittedAt`, xóa lý do từ chối cũ.
- **Xuất bản truyện** (`publishStory`): người không phải quản trị viên mà truyện chưa `approved` → `story_not_approved`. Quản trị viên xuất bản thì truyện tự thành `approved`.
- **Tạo truyện kèm "Đăng"** (`createStory` với `publish: true`): tác giả → chương đầu xuất bản, truyện vẫn nháp và thành `pending`; quản trị viên → công khai ngay và `approved` (như hiện nay).
- **Ẩn truyện** (`unpublishStory`): như cũ, truyện vẫn `approved`.
- **Chương công khai cuối:** luật `last_published_chapter` áp dụng thêm cho truyện `pending`, để quản trị viên luôn có chương để đọc.
- **Duyệt** (`reviewStory({ storyId, approve: true })`): chỉ truyện đang `pending` (không thì `not_pending`). Truyện thành `approved` (ghi `reviewedAt`) và công khai luôn (đặt `published_at` như lần đầu công khai).
- **Từ chối** (`reviewStory({ storyId, approve: false, reason })`): chỉ truyện đang `pending`; lý do 1–500 ký tự, bắt buộc (`reason_required`). Truyện thành `rejected`, ghi `reviewedAt` và lý do.
- **Gỡ truyện** (`setStoryTakedown`): ngoài việc về nháp, xóa luôn trạng thái duyệt (`review = null`); truyện đang chờ duyệt mà bị gỡ thì rời hàng chờ. Khôi phục không đổi trạng thái duyệt (vẫn `null`).

## 3. Dữ liệu

### Kiểu (`src/types/story.ts`)

```ts
type ReviewStatus = 'pending' | 'approved' | 'rejected'
type StoryReview = {
  status: ReviewStatus
  submittedAt: string | null
  reviewedAt: string | null
  /** Lý do từ chối (chỉ khi rejected) */
  reason: string | null
}
```

- `MyStory.review: StoryReview | null` (khu Sáng tác).
- `AdminStory` thêm `review: StoryReview | null`, `authorName: string | null`, `genreSlugs: string[]`.

### `features/studio/api`

| Hàm | Việc |
|---|---|
| `submitStoryForReview(id)` | Mới: gửi duyệt / gửi duyệt lại |
| `publishStory(id)` | Thêm lỗi `story_not_approved` |
| `createStory(input, { publish: true })` | Tác giả: truyện thành `pending` thay vì công khai |

`StudioErrorCode` thêm `story_not_approved`, `already_pending`, `already_approved` (câu báo lỗi tiếng Việt trong `shared.ts`). Hook `useSubmitStoryForReview(id)` invalidate như `useSetStoryVisibility`.

### `features/admin/api`

| Hàm | Việc |
|---|---|
| `getAdminStories(query)` | Thêm lọc `review: 'pending' \| 'rejected'` và cột sắp xếp `submitted`; trả thêm `review`, `authorName`, `genreSlugs` |
| `reviewStory({ storyId, approve, reason })` | Duyệt / từ chối |
| `setStoryTakedown` | Như cũ (xóa trạng thái duyệt nằm ở DB / bản giả) |
| `getAdminOverview` | `totals.pendingReviews`: số truyện đang chờ duyệt |

Hàng chờ duyệt dùng lại `getAdminStories` (một nguồn dữ liệu cho mọi bảng truyện của quản trị), không thêm RPC riêng. `AdminErrorCode` thêm `not_pending`, `reason_required`.

### Database (migration `story_review`)

- Enum `public.review_status` (`pending`, `approved`, `rejected`).
- `stories` thêm `review_status`, `review_submitted_at`, `reviewed_at`, `review_reason` (1–500 ký tự, chỉ có khi `rejected`). Không cấp quyền ghi các cột này cho `authenticated` (grant theo cột hiện có không gồm chúng), nên tác giả chỉ đổi được qua RPC.
- **Dữ liệu cũ:** truyện đã từng công khai (`published_at` khác null) và không bị gỡ → `approved`, `reviewed_at = published_at`. Tạm tắt trigger `stories_set_updated_at` khi cập nhật để không đổi `updated_at` (thứ tự khu Sáng tác).
- **Trigger `stories_require_review`** (before insert / update of `visibility`): chuyển sang `published` mà người gọi không phải quản trị viên và truyện chưa `approved` → `story_not_approved`; quản trị viên thì đặt `approved` (+ `reviewed_at`) luôn.
- **RPC `submit_story_for_review(p_story_id)`**: DEFINER ở `private`, lớp vỏ invoker ở `public`, kiểm tra chủ truyện và các lỗi ở mục 2.
- **RPC `admin_review_story(p_story_id, p_approve, p_reason)`**: DEFINER ở `private` (tự kiểm tra `require_admin()`), lớp vỏ ở `public`; chỉ `authenticated` được EXECUTE.
- **`create_story`**: `p_publish` với người không phải quản trị viên → chương đầu xuất bản, truyện `pending`.
- **`chapters_before_change`**: luật `last_published_chapter` tính cả truyện `review_status = 'pending'`.
- **`admin_set_story_takedown`**: gỡ thì xóa bốn cột duyệt.
- **RLS:** sửa policy đọc đang có (không thêm policy permissive thứ hai, tránh cảnh báo advisor) để quản trị viên đọc được truyện `pending` và chương đã xuất bản của truyện đó: `stories_select_visible`, `chapters_select_visible`.
- **View `studio_stories`**: thêm bốn cột duyệt.
- **`admin_stories`**: trả thêm `author_name`, `genre_slugs`, bốn cột duyệt (drop rồi tạo lại cả hai lớp).
- **`admin_overview`**: thêm `pendingReviews`.

### Bản giả

- `StoredStory.review?: StoryReview | null`. Dữ liệu cũ không có trường này: `publishedAt` khác null và không bị gỡ → coi là `approved` (một hàm đọc chung trong `mocks/userContent.ts`).
- `catalog()` cho quản trị viên thấy truyện `pending` (như chủ truyện thấy bản nháp).
- Luật như mục 2, trong `features/studio/api.mock.ts` và `features/admin/api.mock.ts`.

## 4. Giao diện tác giả (khu Sáng tác)

- **Danh sách `/studio`:** `StatusBadge` thêm nhãn **Chờ duyệt** và **Bị từ chối** (vẫn có Công khai, Nháp, Bị gỡ). Truyện đã duyệt mà đang ẩn vẫn là "Nháp".
- **Trang quản lý truyện** (`PublishControls`):

  | Trạng thái | Hiển thị |
  |---|---|
  | Chưa gửi | Nút **"Gửi duyệt"** + dòng giải thích "Truyện mới cần ban quản trị duyệt trước khi công khai". Chưa có chương đã xuất bản thì nút khóa và có gợi ý như hiện nay |
  | Chờ duyệt | Thông báo "Truyện đang chờ ban quản trị duyệt (gửi lúc …). Bạn vẫn sửa truyện và viết thêm chương được." Không có nút xuất bản |
  | Bị từ chối | Thông báo lỗi kèm lý do + nút **"Gửi duyệt lại"** |
  | Đã duyệt | Như hiện nay: "Xuất bản truyện" / "Ẩn truyện" |
  | Bị gỡ | Như hiện nay |

  Quản trị viên luôn thấy "Xuất bản truyện" / "Ẩn truyện". Nút "Xem trước" giữ nguyên.
- **Form tạo truyện `/studio/new`:** tác giả thấy nút **"Đăng và gửi duyệt"** (xuất bản chương đầu + gửi duyệt); dòng giới thiệu đổi theo. Quản trị viên vẫn thấy "Đăng truyện".
- Câu báo khi xuất bản chương / nhập chương đã rà: không câu nào nói "người đọc đã thấy", chỉ khối xuất bản của trang quản lý truyện cần đổi.

## 5. Giao diện quản trị

- **Trang mới `/admin/reviews` "Duyệt truyện"** (`paths.adminReviews`), ngay dưới "Truyện" ở thanh bên. Bảng theo quy ước bảng quản trị (lọc, sắp xếp, phân trang ở máy chủ; trạng thái trên URL; `tableParams`, `TableFilters`).
  - Cột: Truyện (tên + link **"Xem trước"** mở trang truyện ở tab mới), Tác giả (tên tài khoản, bút danh), Thể loại, Chương (đã xuất bản / tổng), Gửi lúc, Thao tác (ghim phải từ màn `lg`). Mặc định gửi trước xếp trước (`?sort=submitted&order=asc` là mặc định nên không ghi lên URL).
  - Lọc: ô tìm tên truyện / tác giả (`?q=`), trạng thái `?status=pending` (mặc định) / `rejected`. Truyện bị từ chối có thêm cột lý do và lúc từ chối, không có nút thao tác.
  - **Duyệt:** `Popconfirm` xác nhận. **Từ chối:** hộp thoại nhập lý do (bắt buộc, tối đa 500 ký tự).
  - `not_pending` (người khác vừa xử lý, tác giả vừa xóa truyện): báo "Truyện không còn chờ duyệt" và tải lại.
  - Thao tác xong invalidate `['admin']` và các key công khai (`['stories']`, `['chapters']`, `['genres']`).
- **Tổng quan:** ô số liệu "Chờ duyệt", bấm sang `/admin/reviews`.
- **Bảng Truyện:** bộ lọc trạng thái thêm "Chờ duyệt" và "Bị từ chối"; cột trạng thái hiện nhãn tương ứng.
- **Trang truyện `/story/:slug` khi truyện chưa công khai** (chủ truyện và quản trị viên xem trước): dải thông báo đầu trang "Truyện chưa công khai, người đọc chưa thấy trang này".

## 6. Kiểm tra

- **Test api bản giả, Sáng tác:** tác giả tạo + "Đăng" → `pending`, không có trong danh sách công khai; `publishStory` khi chưa duyệt → `story_not_approved`; gửi duyệt (thiếu chương, bị gỡ, đang chờ, đã duyệt); đã duyệt thì tự ẩn/hiện; ẩn hoặc xóa chương công khai cuối của truyện `pending` bị chặn; quản trị viên tạo + đăng → công khai ngay; nhập hàng loạt vẫn công khai.
- **Test api bản giả, Quản trị:** lọc `review`, sắp xếp `submitted`; duyệt → công khai và có trong danh sách công khai; từ chối cần lý do; `not_pending`; người thường bị `forbidden`; gỡ xóa trạng thái duyệt; `pendingReviews`; quản trị viên xem được truyện và chương của truyện `pending`, người khác thì không.
- **Test bản remote** (`features/studio/api.remote.test.ts`): gọi đúng RPC, map cột duyệt, map mã lỗi mới. Bản remote của Quản trị chưa có bộ test client giả; RPC của nó được kiểm bằng ca SQL bên dưới.
- **Test luồng:** tác giả "Đăng và gửi duyệt" → nhãn "Chờ duyệt"; quản trị viên duyệt ở `/admin/reviews` → tác giả thấy "Công khai"; từ chối kèm lý do → tác giả thấy lý do, "Gửi duyệt lại" → về hàng chờ.
- **`supabase/checks/rls_and_rules.sql`:** tác giả không tự công khai / không tự ghi cột duyệt; gửi duyệt và các mã lỗi; quản trị viên duyệt, từ chối; người thường gọi `admin_review_story` bị chặn; quản trị viên đọc được truyện `pending` và chương của nó, khách và người khác thì không; gỡ xóa trạng thái duyệt; chương công khai cuối của truyện `pending`.
- Giao diện ở 375 / 768 / 1440px, cả hai theme.

## 7. Các bước

1. Kiểu + bản giả + test api Sáng tác.
2. Bản giả + test api Quản trị.
3. Giao diện Sáng tác + test luồng.
4. Trang `/admin/reviews`, Tổng quan, bảng Truyện, dải thông báo trang truyện + test luồng.
5. Migration + ca kiểm tra SQL (thử trước bằng transaction rollback), push, advisors, sinh kiểu; bản remote + test.
6. Cập nhật `thiet-ke-database.md`, `CLAUDE.md`, lộ trình, ghi chú ở `plan-sang-tac-va-the-loai.md`; kiểm tra giao diện; chạy toàn bộ test, lint, build; gộp vào `main`.

**Thứ tự deploy:** push migration làm frontend cũ trên production báo lỗi chung khi tác giả bấm "Xuất bản truyện" (trigger mới ném `story_not_approved`), nên phần DB làm sau cùng (bước 5) và gộp `main` ngay sau khi push.
