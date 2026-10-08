import type { User } from './user'

export type Comment = {
  id: string
  storySlug: string
  /** null: bình luận của cả truyện; có số: bình luận của chương đó */
  chapterNumber: number | null
  user: Pick<User, 'id' | 'displayName' | 'avatarUrl'>
  content: string
  createdAt: string
  /** null: bình luận gốc; có giá trị: trả lời của bình luận gốc đó (chỉ một cấp) */
  parentId: string | null
  /** Số trả lời của bình luận gốc (trả lời thì luôn 0) */
  replyCount: number
  likeCount: number
  /** Người xem đã thích bình luận này chưa (khách: luôn false) */
  likedByMe: boolean
  /** Lần sửa nội dung gần nhất; null: chưa sửa */
  editedAt: string | null
  /** Người viết là chủ truyện (truyện không có bút danh): hiện nhãn "Tác giả" */
  isAuthor: boolean
}

/** Thứ tự bình luận gốc: mới nhất trước | nhiều lượt thích trước */
export type CommentSort = 'newest' | 'top'

/** Lý do báo cáo một bình luận vi phạm */
export type CommentReportReason = 'spam' | 'offensive' | 'spoiler' | 'other'

export type Score = 1 | 2 | 3 | 4 | 5

export type RatingSummary = {
  average: number
  count: number
  distribution: Record<Score, number>
}
