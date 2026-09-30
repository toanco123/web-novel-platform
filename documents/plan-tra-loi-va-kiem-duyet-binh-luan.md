# Plan: Trả lời bình luận và kiểm duyệt bình luận

Trạng thái: ✅ xong (30/09/2026). Nhánh `comment-replies-moderation`.

## Context

Bình luận là nội dung công khai do người dùng viết, nhưng hiện chỉ có viết và tự xóa. Người đọc không báo cáo được bình luận vi phạm, quản trị viên chỉ thấy số bình luận chứ không xem hay xóa được, và chưa có trả lời bình luận (ghi "để làm sau" ở `plan-trang-chi-tiet-truyen.md`).

## Phạm vi

1. **Trả lời bình luận** (một cấp) ở cả bình luận truyện và bình luận chương.
2. **Báo cáo bình luận** của người khác.
3. **Trang quản trị `/admin/comments`:** xem bình luận bị báo cáo và mọi bình luận, xóa bình luận, bỏ qua báo cáo.

Ngoài phạm vi: tác giả tự xóa bình luận trong truyện của mình, thông báo khi có người trả lời, sửa bình luận, thích bình luận.

## 1. Trả lời bình luận

- **Một cấp:** trả lời nằm dưới bình luận gốc. Bấm "Trả lời" ở một câu trả lời thì vẫn viết vào nhóm của bình luận gốc, ô nhập điền sẵn `@Tên `.
- **Danh sách:** `getComments` chỉ trả bình luận gốc (mới nhất trước), mỗi bình luận có `replyCount`. `total` và phân trang tính theo bình luận gốc.
- **Xem trả lời:** nút "Xem N trả lời" tải trả lời của bình luận đó (`getReplies`, cũ nhất trước, tối đa 200). Gửi trả lời xong thì nhóm tự mở.
- **Xóa:** xóa bình luận gốc thì xóa luôn các trả lời; hộp thoại xác nhận nói rõ số trả lời sẽ mất.
- **Chống spam:** trả lời tính chung giới hạn của bình luận (3 / phút, 30 / giờ, không gửi lại nội dung vừa gửi).
- **Khách:** thấy nút "Trả lời" và "Báo cáo"; bấm thì sang trang đăng nhập (`paths.login(next)`).

## 2. Báo cáo bình luận

- Nút "Báo cáo" trên bình luận và trả lời của người khác. Hộp thoại chọn lý do: spam / quảng cáo, xúc phạm / quấy rối, tiết lộ nội dung, lý do khác (bắt buộc ghi chú). Ghi chú tối đa 500 ký tự.
- Mỗi người chỉ có một báo cáo đang mở cho mỗi bình luận: báo lại thì cập nhật lý do và ghi chú.
- Không báo cáo được bình luận của chính mình (`own_comment`). Tối đa 10 báo cáo / giờ mỗi người (`rate_limited`).
- Bản giả không báo cáo được bình luận mẫu (bình luận sinh sẵn trong code, không xóa được).

## 3. Trang quản trị `/admin/comments`

- Hai chế độ (`?view=`): **Bị báo cáo** (mặc định; bình luận có báo cáo đang mở, báo cáo mới nhất trước) và **Tất cả** (`?view=all`, mới viết trước). Tìm theo nội dung hoặc tên người viết (`?q=`), phân trang (`?page=`).
- Mỗi hàng: nội dung, người viết, truyện và chương (link sang trang công khai nếu truyện đang công khai), lúc viết, các báo cáo đang mở (lý do, ghi chú, người báo).
- Thao tác: **Xóa** (xác nhận; xóa luôn trả lời và báo cáo của nó) và **Bỏ qua** (đánh dấu các báo cáo đang mở là đã xử lý, bình luận giữ nguyên).
- Ô "Bình luận" ở trang Tổng quan ghi số bình luận đang bị báo cáo và dẫn sang trang này.
- Tên người viết dẫn sang trang Người dùng đã tìm sẵn theo tên đó (để khóa tài khoản spam).

## 4. Dữ liệu

### Kiểu

```ts
// src/types/comment.ts
type Comment = {
  ...
  parentId: string | null   // null: bình luận gốc
  replyCount: number        // số trả lời (trả lời thì luôn 0)
}
type CommentReportReason = 'spam' | 'offensive' | 'spoiler' | 'other'
```

### `features/comments/api`

| Hàm | Việc |
|---|---|
| `getComments(slug, { chapter, cursor })` | Bình luận gốc, kèm `replyCount` |
| `getReplies(commentId)` | Trả lời của một bình luận, cũ nhất trước |
| `addComment(slug, content, chapter, parentId)` | `parentId` có giá trị: trả lời. Bình luận gốc không còn thì ném `AuthError` "Bình luận này đã bị xóa…" |
| `deleteComment(id)` | Như cũ; xóa kèm trả lời |
| `reportComment({ commentId, reason, note })` | Báo cáo bình luận |

### `features/admin/api`

| Hàm | Việc |
|---|---|
| `getAdminComments({ view, q, page })` | `Page<AdminComment>` |
| `deleteAdminComment(id)` | Xóa bình luận bất kỳ |
| `dismissCommentReports(commentId)` | Đóng các báo cáo đang mở của bình luận |
| `getAdminOverview` | `totals.reportedComments`: số bình luận có báo cáo đang mở |

### Database (migration `comment_replies_and_reports`)

- `comments.parent_id uuid references comments (id) on delete cascade`; cấp `insert (parent_id)` cho `authenticated`.
- Trigger `comments_check_parent` (before insert): bình luận gốc phải tồn tại (`parent_not_found`), không phải là một trả lời và cùng truyện, cùng chương (`invalid_parent`).
- RPC `comment_threads(p_story_id, p_chapter)` (invoker, RLS áp dụng): bình luận gốc kèm tên, ảnh người viết và `reply_count`; client thêm `order` và `range`.
- Bảng `private.comment_reports` (`comment_id`, `reporter_id`, `reason`, `note`, `status`, `created_at`, `resolved_at`), unique `(reporter_id, comment_id)` khi `status = 'open'`. Không ai đọc ghi trực tiếp.
- RPC `report_comment(p_comment_id, p_reason, p_note)`: lớp vỏ invoker ở `public`, phần chạy DEFINER ở `private`. Mã lỗi: `unauthenticated`, `not_found` (bình luận không có hoặc truyện không công khai), `own_comment`, `rate_limited`.
- RPC admin: `admin_comments(p_query, p_reported)`, `admin_delete_comment(p_id)`, `admin_dismiss_comment_reports(p_comment_id)`; `admin_overview` thêm `reportedComments`.

### Bản giả

- Bình luận người dùng (`mock-comments`) thêm `parentId`. Bình luận mẫu không có trả lời sẵn nhưng trả lời được.
- Báo cáo lưu ở `mocks/activity.ts` (`mock-comment-reports`).
- Xóa bình luận ở mọi nơi (tự xóa, admin xóa, xóa chương, xóa tài khoản) đi qua `removeComments()` của `mocks/activity.ts` để xóa kèm trả lời và báo cáo.

## 5. Giao diện người đọc (`features/comments/components`)

- `CommentItem`: một bình luận gốc, gồm nội dung, hàng nút (Trả lời, Báo cáo, Xóa) và nhóm trả lời.
- `ReplyThread`: nút "Xem N trả lời" / "Ẩn trả lời", danh sách trả lời (thụt vào, có vạch trái), ô viết trả lời.
- `CommentForm`: thêm `parentId`, `initialContent`, `onDone`; khi là trả lời thì nhãn "Viết trả lời", nút "Gửi trả lời".
- `ReportCommentDialog`: theo mẫu `ReportChapterDialog`.
- `DeleteCommentDialog`: thêm `replyCount` để đổi lời xác nhận.

## 6. Kiểm tra

- Test api bản giả: trả lời không lẫn vào danh sách gốc và `replyCount` đúng; xóa gốc xóa luôn trả lời; không trả lời được vào một trả lời hay bình luận đã xóa; báo cáo (báo lại thì cập nhật, không báo bình luận của mình, giới hạn 10 / giờ); admin xem, xóa, bỏ qua; người thường bị chặn.
- Test luồng: người đọc trả lời và mở nhóm trả lời; khách bấm "Trả lời" sang đăng nhập; báo cáo bình luận; admin thấy bình luận bị báo cáo, bỏ qua, xóa.
- `supabase/checks/rls_and_rules.sql`: trả lời hợp lệ và không hợp lệ, `comment_threads` đếm trả lời, xóa gốc kéo theo trả lời và báo cáo, `report_comment` (các mã lỗi, báo lại), RPC admin chỉ admin gọi được, người thường không đọc được `private.comment_reports`.
- Giao diện ở 375 / 768 / 1440px, cả hai theme.

## 7. Các bước

1. Bản giả + test: trả lời (`getComments`, `getReplies`, `addComment`, `deleteComment`).
2. Bản giả + test: `reportComment`.
3. Bản giả + test: api admin và `reportedComments`.
4. Migration, ca kiểm tra SQL, push, sinh kiểu, bản remote của comments và admin.
5. Giao diện người đọc + test luồng.
6. Trang `/admin/comments`, ô "Bình luận" ở Tổng quan + test luồng.
7. Cập nhật `thiet-ke-database.md`, `CLAUDE.md`, lộ trình; kiểm tra giao diện; chạy toàn bộ test, lint, build; gộp vào `main`.
