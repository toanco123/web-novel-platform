// Phần dùng chung của hai backend bình luận và chấm điểm (api.mock.ts, api.remote.ts)
import { AuthError } from '@/features/auth/api'
import type { Comment, CommentReportReason } from '@/types/comment'

export const COMMENTS_PER_PAGE = 10

/** Một trang bình luận: nextCursor là vị trí bắt đầu của trang sau, null khi đã hết */
export type CommentPage = { items: Comment[]; total: number; nextCursor: number | null }

/** Số trả lời tối đa tải về cho một bình luận */
export const REPLIES_LIMIT = 200

/** Số lượt thích mới tối đa mỗi giờ của một người (như trigger comment_likes_guard) */
export const LIKES_PER_HOUR = 300

// Dùng AuthError để form hiện được lời báo (authErrorMessage chỉ hiện lời của AuthError)
/** Bình luận gốc đã bị xóa trong lúc người dùng đang viết trả lời */
export const parentDeleted = () =>
  new AuthError('unknown', 'Bình luận này đã bị xóa nên không trả lời được nữa.')
/** Trả lời vào một câu trả lời, hoặc vào bình luận của truyện/chương khác (chỉ khi gọi thẳng api) */
export const invalidParent = () => new AuthError('unknown', 'Không trả lời được bình luận này.')

/** Báo cáo một bình luận vi phạm; note được bỏ khoảng trắng ở hai đầu khi lưu */
export type ReportCommentInput = { commentId: string; reason: CommentReportReason; note: string }

export const ownCommentReport = () =>
  new AuthError('unknown', 'Bạn không thể báo cáo bình luận của chính mình.')
/** Bình luận đã bị xóa, hoặc truyện không còn công khai */
export const commentGone = () => new AuthError('unknown', 'Bình luận này không còn nữa.')

export const ownCommentLike = () =>
  new AuthError('unknown', 'Bạn không thể tự thích bình luận của mình.')
