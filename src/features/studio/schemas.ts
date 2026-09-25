import { z } from 'zod'

export const DESCRIPTION_MAX = 3000
export const CONTENT_MIN = 100
export const CONTENT_MAX = 100_000

export const storySchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Tên truyện cần ít nhất 2 ký tự')
    .max(120, 'Tên truyện tối đa 120 ký tự'),
  description: z
    .string()
    .trim()
    .min(30, 'Giới thiệu cần ít nhất 30 ký tự để người đọc hiểu truyện nói về gì')
    .max(DESCRIPTION_MAX, `Giới thiệu tối đa ${DESCRIPTION_MAX} ký tự`),
  genreSlugs: z
    .array(z.string())
    .min(1, 'Chọn ít nhất 1 thể loại')
    .max(5, 'Chọn tối đa 5 thể loại'),
  status: z.enum(['ongoing', 'completed']),
  coverUrl: z.string().nullable(),
})

export type StoryValues = z.infer<typeof storySchema>

export const chapterSchema = z.object({
  title: z.string().trim().max(120, 'Tiêu đề chương tối đa 120 ký tự'),
  content: z
    .string()
    .trim()
    .min(CONTENT_MIN, `Nội dung chương cần ít nhất ${CONTENT_MIN} ký tự`)
    .max(CONTENT_MAX, `Nội dung chương tối đa ${CONTENT_MAX.toLocaleString('vi-VN')} ký tự`),
})

export type ChapterValues = z.infer<typeof chapterSchema>

/** Chương 1 viết ngay trong form tạo truyện: để trống nội dung thì chỉ tạo truyện */
export const firstChapterSchema = z
  .object({
    title: chapterSchema.shape.title,
    content: z
      .string()
      .trim()
      .max(CONTENT_MAX, `Nội dung chương tối đa ${CONTENT_MAX.toLocaleString('vi-VN')} ký tự`),
  })
  .superRefine(({ title, content }, ctx) => {
    if (content && content.length < CONTENT_MIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['content'],
        message: `Nội dung chương cần ít nhất ${CONTENT_MIN} ký tự`,
      })
    }
    if (!content && title) {
      ctx.addIssue({
        code: 'custom',
        path: ['content'],
        message: 'Viết nội dung chương 1 hoặc xóa tiêu đề chương',
      })
    }
  })

/** Form truyện: thông tin truyện + chương 1 (chỉ hiện khi tạo truyện mới) */
export const storyFormSchema = storySchema.extend({ chapter: firstChapterSchema })

export type StoryFormValues = z.infer<typeof storyFormSchema>

/** Số chữ (từ) của văn bản */
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
