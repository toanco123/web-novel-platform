// Phần dùng chung của hai backend bình luận và chấm điểm (api.mock.ts, api.remote.ts)
import type { Comment } from '@/types/comment'

export const COMMENTS_PER_PAGE = 10

/** Một trang bình luận: nextCursor là vị trí bắt đầu của trang sau, null khi đã hết */
export type CommentPage = { items: Comment[]; total: number; nextCursor: number | null }
