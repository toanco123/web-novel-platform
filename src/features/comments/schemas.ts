import { z } from 'zod'
import type { CommentReportReason } from '@/types/comment'

export const COMMENT_MAX = 1000

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Viết gì đó trước khi gửi nhé')
    .max(COMMENT_MAX, `Bình luận tối đa ${COMMENT_MAX} ký tự`),
})

export type CommentValues = z.infer<typeof commentSchema>

export const commentReportReasons: { value: CommentReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam, quảng cáo' },
  { value: 'offensive', label: 'Xúc phạm, quấy rối' },
  { value: 'spoiler', label: 'Tiết lộ nội dung truyện' },
  { value: 'other', label: 'Lý do khác' },
]

export const COMMENT_REPORT_NOTE_MAX = 500

export const commentReportSchema = z
  .object({
    reason: z.enum(['spam', 'offensive', 'spoiler', 'other']),
    note: z
      .string()
      .trim()
      .max(COMMENT_REPORT_NOTE_MAX, `Ghi chú tối đa ${COMMENT_REPORT_NOTE_MAX} ký tự`),
  })
  .refine((d) => d.reason !== 'other' || d.note.length > 0, {
    path: ['note'],
    message: 'Mô tả ngắn lý do báo cáo',
  })

export type CommentReportValues = z.infer<typeof commentReportSchema>
