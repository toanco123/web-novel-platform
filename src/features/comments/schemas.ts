import { z } from 'zod'

export const COMMENT_MAX = 1000

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Viết gì đó trước khi gửi nhé')
    .max(COMMENT_MAX, `Bình luận tối đa ${COMMENT_MAX} ký tự`),
})

export type CommentValues = z.infer<typeof commentSchema>
