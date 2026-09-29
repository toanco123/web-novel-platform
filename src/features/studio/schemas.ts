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
  /** Bút danh / tác giả gốc; trống thì hiển thị tên tài khoản */
  authorName: z.string().trim().max(60, 'Bút danh tối đa 60 ký tự'),
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

export const CHAPTER_NUMBER_MAX = 99_999

/** Số chương do người viết chọn */
const chapterNumberSchema = z
  .number({ error: 'Nhập số chương' })
  .int('Số chương phải là số nguyên')
  .min(1, 'Số chương từ 1 trở lên')
  .max(CHAPTER_NUMBER_MAX, `Số chương tối đa ${CHAPTER_NUMBER_MAX.toLocaleString('vi-VN')}`)

/**
 * Form soạn chương: thêm số chương do người viết chọn (được bỏ trống số ở giữa),
 * không trùng số của chương khác trong truyện (`takenNumbers`).
 */
export const chapterFormSchema = (takenNumbers: number[]) =>
  chapterSchema.extend({
    number: chapterNumberSchema.superRefine((n, ctx) => {
      if (takenNumbers.includes(n)) {
        ctx.addIssue({ code: 'custom', message: `Chương ${n} đã có, chọn số khác` })
      }
    }),
  })

export type ChapterFormValues = z.infer<ReturnType<typeof chapterFormSchema>>

/**
 * Chương đầu tiên viết ngay trong form tạo truyện: để trống nội dung thì chỉ tạo truyện.
 * Số chương mặc định 1, đổi được (truyện đăng tiếp từ nơi khác, bắt đầu từ chương 50).
 */
export const firstChapterSchema = z
  .object({
    // Ô số để trống cho ra NaN; chỉ kiểm tra khi có viết chương
    number: z.number().or(z.nan()),
    title: chapterSchema.shape.title,
    content: z
      .string()
      .trim()
      .max(CONTENT_MAX, `Nội dung chương tối đa ${CONTENT_MAX.toLocaleString('vi-VN')} ký tự`),
  })
  .superRefine(({ number, title, content }, ctx) => {
    const numberCheck = chapterNumberSchema.safeParse(number)
    if (content && !numberCheck.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['number'],
        message: numberCheck.error.issues[0].message,
      })
    }
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
        message: 'Viết nội dung chương hoặc xóa tiêu đề chương',
      })
    }
  })

/** Form truyện: thông tin truyện + chương đầu tiên (chỉ hiện khi tạo truyện mới) */
export const storyFormSchema = storySchema.extend({ chapter: firstChapterSchema })

export type StoryFormValues = z.infer<typeof storyFormSchema>

/** Số chữ (từ) của văn bản */
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
