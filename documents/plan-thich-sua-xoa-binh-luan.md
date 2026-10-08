# Plan: Thích, sửa bình luận và tác giả xóa bình luận

Trạng thái: ✅ xong (08/10/2026), migration đã push lên DB production. Nhánh `comment-likes-edits`. App di động làm sau.

**Khác so với bản spec đã duyệt** (phát hiện lúc làm):
- Không tạo index `comments (story_id, chapter_number, like_count desc, …)`: `comment_threads` có `set search_path` nên không được gộp vào câu truy vấn ngoài, `.order()` của PostgREST không dùng được index này. Sắp xếp chỉ chạy trên bình luận của một truyện (đã lọc bằng index có sẵn).
- `anon` có quyền select `comment_likes` (không có policy cho `anon` nên không thấy dòng nào): `comment_threads` là INVOKER, khách gọi cũng phải đọc được bảng để tính `liked_by_me`.
- `CommentsSection` không nhận prop `ownerId` (trang đọc không có `ownerId` trong `ChapterContent`): tự gọi `useStory(slug, { enabled: !!user })`; trang chi tiết truyện có sẵn trong cache.
- Bình luận của chính mình: tim chỉ là chữ (`title` "Không thể tự thích bình luận của mình"), không phải nút bị tắt có tooltip.
- Sửa thêm ba ca xếp hạng cũ trong `rls_and_rules.sql` bị hỏng do DB production đã có truyện thật (loại truyện có sẵn bằng `existing_stories`).
- App di động: khi đồng bộ (`sync-from-web`) cần lấy `types/comment.ts`, `features/comments/shared.ts`, `api.remote.ts` (thêm `editComment`, `setCommentLike`, `sort`).

## Context

Bình luận hiện có viết, trả lời một cấp, tự xóa, báo cáo và chặn (`plan-tra-loi-va-kiem-duyet-binh-luan.md`). Ba việc ghi "ngoài phạm vi" ở plan đó là thích bình luận, sửa bình luận và tác giả xóa bình luận trong truyện của mình. Người dùng chọn làm ba việc này trước trong nhóm "đáng làm, không gấp" (trước hẹn giờ đăng chương, tối ưu tải trang đợt 3, chèn ảnh vào chương).

Đã chốt với người dùng (08/10/2026):
- **Thích:** nút tim kèm số, cho cả bình luận gốc và trả lời; thêm sắp xếp **Mới nhất / Nổi bật** cho bình luận gốc. Không có danh sách người đã thích.
- **Sửa:** sửa lúc nào cũng được, hiện "đã sửa", không lưu lịch sử. Báo cáo giữ nội dung lúc bị báo cáo để sửa không xóa được dấu vết.
- **Tác giả xóa:** chủ truyện xóa hẳn mọi bình luận, trả lời trong truyện và các chương của mình; bình luận của chủ truyện có nhãn **Tác giả**.
- **Chỉ làm web.** App di động làm sau qua skill `sync-from-web`; thay đổi DB phải tương thích ngược (app hiện tại vẫn chạy).

Ngoài phạm vi: danh sách người đã thích, lịch sử các lần sửa, ghim bình luận, thông báo khi được thích, quản trị viên xóa ngay trên trang truyện (vẫn xóa ở `/admin/comments`), app di động.

## 1. Thích bình luận

- Nút ♥ kèm số lượt thích dưới mọi bình luận gốc và trả lời; số bằng 0 thì chỉ hiện tim.
- Bấm lần nữa để bỏ thích. Thích lại khi đã thích, hoặc bỏ thích khi chưa thích, không báo lỗi.
- **Không tự thích** bình luận của mình (`own_comment_like`): nút bị tắt, chỉ hiện số, tooltip "Không thể tự thích bình luận của mình".
- Chỉ thích được bình luận của truyện đang công khai (cùng điều kiện với viết bình luận).
- Chống spam: tối đa **300 lượt thích mới / giờ** mỗi người (`rate_limited`). Bỏ thích không tính.
- Khách bấm tim thì sang trang đăng nhập (`paths.login(next)`).
- Lượt thích của người mình đã chặn vẫn được tính vào số (số là tổng, không lộ ai đã thích).

## 2. Sắp xếp bình luận

- Nhóm hai nút **Mới nhất | Nổi bật** (`role="radiogroup"`) phía trên danh sách bình luận gốc, chỉ hiện khi có từ 2 bình luận gốc.
- **Mới nhất** (mặc định): như hiện nay (`created_at` giảm dần, rồi `id`).
- **Nổi bật**: `like_count` giảm dần, rồi `created_at` giảm dần, rồi `id`.
- Lựa chọn chỉ giữ trong trang (state), không đưa lên URL: khối bình luận nằm ở cả trang chi tiết truyện và cuối chương.
- Trả lời luôn cũ nhất trước.
- Nối trang ở chế độ Nổi bật có thể trùng khi lượt thích đổi giữa hai lần tải: giữ `uniqueById` như hiện có.

## 3. Sửa bình luận

- Nút **Sửa** dưới bình luận và trả lời của chính mình. Bấm thì nội dung chuyển thành ô nhập điền sẵn (dùng lại `CommentForm` ở chế độ sửa: bộ đếm ký tự, lỗi zod 1–1000 ký tự), nút **Lưu** và **Hủy**; Esc cũng hủy. Nội dung chưa đổi thì "Lưu" bị tắt.
- Sửa không giới hạn thời gian. Chỉ sửa được khi truyện còn công khai (và chương còn xuất bản nếu là bình luận chương); không thì báo "Bình luận này không còn nữa." (`commentGone`).
- Nội dung thay đổi thì đặt `editedAt`. Đầu bình luận hiện "· đã sửa" sau thời gian; `title` là giờ sửa đầy đủ.
- Không lưu lịch sử các lần sửa.
- **Báo cáo giữ bản gốc:** lúc báo cáo (kể cả báo lại), nội dung bình luận được lưu vào báo cáo (`contentSnapshot`). Trang `/admin/comments` hiện khối "Nội dung lúc bị báo cáo" dưới báo cáo khi bản lưu khác nội dung hiện tại. Báo cáo cũ không có bản lưu (`null`) thì không hiện khối này.
- Cột nội dung ở `/admin/comments` thêm "(đã sửa)" khi bình luận đã sửa.

## 4. Tác giả xóa bình luận và nhãn "Tác giả"

- Chủ truyện thấy nút **Xóa** dưới mọi bình luận và trả lời của người khác trong truyện và các chương của mình (cạnh Báo cáo, Chặn). Hộp xác nhận: "Xóa bình luận của {tên}?", báo trước số trả lời mất theo (dùng lại `DeleteCommentDialog`).
- Xóa hẳn: trả lời và báo cáo mất theo (khóa ngoại cascade), như khi quản trị viên xóa.
- Giao diện biết chủ truyện qua `Story.ownerId` (truyền vào `CommentsSection`); quyền thật do RLS.
- **Nhãn "Tác giả"** (chip nhỏ màu rose-gold cạnh tên) khi người viết là chủ truyện **và truyện không có bút danh** (`stories.author_name` null). Truyện quản trị viên nhập hàng loạt dưới bút danh thì bình luận của quản trị viên không mang nhãn.

## 5. Dữ liệu

### Kiểu

```ts
// src/types/comment.ts
type Comment = {
  ...
  likeCount: number
  /** Khách: luôn false */
  likedByMe: boolean
  /** null: chưa sửa */
  editedAt: string | null
  /** Người viết là chủ truyện (truyện không có bút danh) */
  isAuthor: boolean
}
export type CommentSort = 'newest' | 'top'
```

`AdminComment` (`features/admin/shared.ts`): thêm `editedAt: string | null`; mỗi phần tử `reports[]` thêm `contentSnapshot: string | null`.

### `features/comments/api`

| Hàm | Việc |
|---|---|
| `getComments(slug, { chapter, cursor, sort })` | Thêm `sort` (mặc định `'newest'`); mỗi bình luận có `likeCount`, `likedByMe`, `editedAt`, `isAuthor` |
| `getReplies(commentId)` | Thêm bốn trường trên. Remote nhúng `comment_likes(user_id)` (RLS chỉ trả lượt thích của mình) và `stories(owner_id, author_name)` |
| `setCommentLike(commentId, liked)` | Thích / bỏ thích. Lỗi: `commentGone`, `ownCommentLike`, `rate_limited` (qua `limitError`) |
| `editComment(commentId, content)` | Trả về bình luận đã sửa (nội dung đã `trim`). Lỗi: `commentGone` |
| `deleteComment(id)` | Bỏ điều kiện `user_id`: RLS quyết định (người viết hoặc chủ truyện). Không có quyền hoặc không có bình luận thì bỏ qua như cũ |

Lỗi mới ở `shared.ts`: `ownCommentLike()` là `AuthError` ("Bạn không thể tự thích bình luận của mình."), theo quy ước để form và toast hiện được lời báo. Không cần thêm vào `EXPECTED_ERRORS`.

### Hooks (`features/comments/hooks.ts`)

- `commentKeys.list(slug, chapter, sort)`: key có thêm `sort`; `commentKeys.story(slug)` vẫn là tiền tố chung để invalidate.
- `useComments(slug, chapter, sort)`.
- `useCommentLike(slug)`: cập nhật lạc quan mọi trang danh sách gốc và nhóm trả lời đang có trong cache của truyện (đổi `likedByMe`, `likeCount ± 1`); lỗi thì trả lại bản cũ và hiện `toast.error`. Không invalidate danh sách (tránh xáo thứ tự Nổi bật).
- `useEditComment(slug)`: sửa xong ghi bình luận mới vào cache (danh sách gốc và nhóm trả lời), không tải lại cả danh sách.
- `useDeleteComment(slug)`: như cũ.

### Database (migration `comment_likes_and_edits`)

**Thích**
- Bảng `public.comment_likes`: `user_id uuid not null default auth.uid() references profiles (id) on delete cascade`, `comment_id uuid not null references comments (id) on delete cascade`, `created_at timestamptz not null default now()`, khóa chính `(user_id, comment_id)`, index `(comment_id)` và `(user_id, created_at desc)` (đếm giới hạn).
- `comments.like_count integer not null default 0 check (like_count >= 0)`. Client không ghi được (không cấp quyền update cột này).
- RLS `comment_likes`:
  - select: `user_id = auth.uid()`.
  - insert: `user_id = auth.uid()`, bình luận tồn tại, không phải của mình, truyện đang công khai.
  - delete: `user_id = auth.uid()`.
- Trigger DEFINER sau insert / delete trên `comment_likes`: `like_count ± 1`.
- Trigger before insert: kiểm tra tự thích (`own_comment_like`) và giới hạn 300 / giờ (`rate_limited`), như mẫu `comments_rate_limit`. Kiểm tra tự thích trong trigger để client nhận mã lỗi rõ thay vì `42501`.
- Index `comments (story_id, chapter_number, like_count desc, created_at desc) where parent_id is null` cho sắp xếp Nổi bật.

**Sửa**
- `comments.edited_at timestamptz` (null).
- `grant update (content) on comments to authenticated`.
- Policy `comments_update_own`: using và with check `user_id = auth.uid()` cùng điều kiện truyện công khai / chương đã xuất bản như `comments_insert_own`.
- Trigger before update: chỉ khi `content` đổi thì `edited_at = now()` (trigger đếm lượt thích cũng update `comments` nhưng không đổi nội dung, nên không đặt `edited_at`). Client chỉ ghi được `content` nhờ grant theo cột; trigger không ép giữ cột khác vì sẽ chặn cả trigger đếm `like_count`.
- `private.comment_reports.content_snapshot text` (null cho báo cáo cũ). `private.report_comment` ghi nội dung hiện tại vào cột này khi tạo và khi báo lại.
- `private.admin_comments`: trả thêm `edited_at`; mỗi phần tử `reports` thêm `contentSnapshot`. Đổi kiểu trả về nên drop rồi tạo lại cả lớp `private` và lớp vỏ `public`, cấp lại quyền.

**Xóa**
- Policy `comments_delete_own` đổi thành: `user_id = auth.uid()` **hoặc** chủ truyện (`exists (select 1 from stories s where s.id = comments.story_id and s.owner_id = auth.uid())`).

**`comment_threads`**
- Trả thêm `like_count`, `liked_by_me` (`exists` lượt thích của `auth.uid()`; khách luôn false), `edited_at`, `is_author` (`c.user_id = s.owner_id and s.author_name is null`). Đổi kiểu trả về nên drop rồi tạo lại, cấp lại quyền. App hiện tại chỉ đọc các cột cũ nên không ảnh hưởng.

### Bản giả

- Kho mới `mock-comment-likes` ở `mocks/activity.ts`: id bình luận → danh sách id người thích (`loadCommentLikes` / `saveCommentLikes`).
- Bình luận người dùng (`mock-comments`) thêm `editedAt` (dữ liệu cũ thiếu thì `null`). `likeCount`, `likedByMe`, `isAuthor` không lưu, api tính khi đọc.
- Bình luận mẫu: số lượt thích gốc sinh cố định bằng `seededRandom` theo id, cộng lượt thích thật. Thích được; không sửa, không xóa được (như báo cáo hiện nay). Truyện mẫu không có chủ nên không có nhãn Tác giả.
- `removeComments()` xóa luôn lượt thích của bình luận bị xóa. Xóa tài khoản (`mocks/accounts.ts`) xóa lượt thích của người đó.
- `StoredCommentReport` thêm `contentSnapshot`.
- Giới hạn 300 / giờ qua `countSince` (`mocks/rateLimit.ts`), lưu thời điểm thích.
- Chủ truyện xóa bình luận: kiểm tra qua `findStory(slug).ownerId`.

## 6. Giao diện (`features/comments/components`)

- `CommentActions`, thứ tự: ♥ số · Trả lời · rồi
  - của mình: **Sửa** · **Xóa**;
  - của người khác, mình là chủ truyện: **Xóa** · Báo cáo · Chặn;
  - của người khác: Báo cáo · Chặn.
- Nút tim: `aria-pressed`, `aria-label` "Thích bình luận của {tên}" / "Bỏ thích…"; icon `Heart` của lucide, tô `fill` màu primary khi đã thích.
- `CommentBody`: tên · chip **Tác giả** · thời gian · "đã sửa". Khi đang sửa, phần nội dung thay bằng `CommentForm` chế độ sửa.
- `CommentForm`: thêm chế độ sửa (`editing: Comment`): nhãn "Sửa bình luận", nút "Lưu", gọi `useEditComment`; giữ `parentId`/`initialContent` cho chế độ viết.
- `CommentsSection`: thêm prop `ownerId` và state `sort`, nhóm nút sắp xếp (dùng lại kiểu `SegmentedLinks` nếu hợp, không thì nhóm nút riêng cùng dáng). `StoryDetailPage` và trang đọc truyền `story.ownerId`.
- `CommentItem`: nhận `ownerId` để quyết định nút Xóa.
- `/admin/comments`: khối "Nội dung lúc bị báo cáo" (chữ mờ, viền trái) và "(đã sửa)".

## 7. Kiểm tra

- **Test api bản giả** (`features/comments/api.test.ts`): thích / bỏ thích / lặp lại; không tự thích; giới hạn 300 / giờ; khách không thích được; `sort: 'top'` đúng thứ tự; sửa đặt `editedAt` và `trim`; người khác không sửa được; chủ truyện xóa được bình luận và trả lời của người khác, người khác thì không; xóa bình luận xóa luôn lượt thích; báo cáo lưu `contentSnapshot`; `isAuthor` đúng và không gắn khi truyện có bút danh.
- **Test bản remote** (mock supabase như test hiện có): tham số `order` theo `sort`, ánh xạ lỗi `own_comment_like` / `rate_limited` / `42501`, `deleteComment` không lọc `user_id`.
- **Test luồng** (`comments-flow.test.tsx`): bấm tim thì số tăng ngay; khách bấm tim sang đăng nhập; sửa, lưu xong thấy "đã sửa"; Esc hủy; chủ truyện thấy Xóa dưới bình luận người khác; đổi sang Nổi bật thì thứ tự đổi.
- **Test admin**: hiện "Nội dung lúc bị báo cáo" khi bản lưu khác nội dung hiện tại.
- **SQL** (`supabase/checks/rls_and_rules.sql`, theo skill `db-migration`): không tự thích; không thích bình luận của truyện nháp; `like_count` tăng giảm đúng và client không ghi được; người khác không sửa được; sửa đặt `edited_at`; chủ truyện xóa được bình luận người khác, người lạ thì không; `report_comment` lưu `content_snapshot`; `comment_threads` trả `liked_by_me`, `is_author` đúng.
- Giao diện ở 375 / 768 / 1440px, cả hai theme.

## 8. Các bước

1. Bản giả + test: thích, sắp xếp Nổi bật.
2. Bản giả + test: sửa, `contentSnapshot` trong báo cáo, chủ truyện xóa, `isAuthor`.
3. Migration, ca kiểm tra SQL, push, sinh kiểu; bản remote của comments và admin + test.
4. Giao diện người đọc + test luồng.
5. `/admin/comments` + test.
6. Cập nhật `thiet-ke-database.md`, `CLAUDE.md`, lộ trình (`plan-bo-cuc-va-cong-nghe.md`), ghi chú app di động cần đồng bộ; kiểm tra giao diện; chạy toàn bộ test, lint, build; gộp vào `main`.
