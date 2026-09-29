import { z } from 'zod'
import { contentText, normalizeContent } from '@/features/chapters/richText'

export const DESCRIPTION_MAX = 3000
/** Giới hạn độ dài chương tính trên chữ nhìn thấy (không tính thẻ định dạng) */
export const CONTENT_MIN = 100
export const CONTENT_MAX = 100_000
/** Giới hạn bản lưu (có thẻ định dạng), khớp ràng buộc `chapters.content` trong DB */
export const CONTENT_STORED_MAX = 200_000

const tooShort = `Nội dung chương cần ít nhất ${CONTENT_MIN} ký tự`
const tooLong = `Nội dung chương tối đa ${CONTENT_MAX.toLocaleString('vi-VN')} ký tự`

/**
 * Nội dung từ trình soạn (HTML) hoặc văn bản thuần: kiểm tra trên chữ nhìn thấy, rồi dựng lại HTML
 * sạch để lưu (`normalizeContent`). Không kiểm tra độ dài tối thiểu (chương đầu tiên được để trống).
 */
const contentField = z.string().transform((content, ctx) => {
  const text = contentText(content)
  if (text.length > CONTENT_MAX) ctx.addIssue({ code: 'custom', message: tooLong })
  const stored = text ? normalizeContent(content) : ''
  if (stored.length > CONTENT_STORED_MAX) {
    ctx.addIssue({
      code: 'custom',
      message: 'Nội dung có quá nhiều định dạng, hãy bớt định dạng hoặc chia thành nhiều chương',
    })
  }
  return stored
})

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
  content: contentField.refine((content) => contentText(content).length >= CONTENT_MIN, tooShort),
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
    content: contentField,
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
    if (content && contentText(content).length < CONTENT_MIN) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: tooShort })
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
