import { z } from 'zod'
import type { ReportReason } from '@/types/report'

export const contactTopics = [
  { value: 'general', label: 'Góp ý chung' },
  { value: 'bug', label: 'Báo lỗi trang web' },
  { value: 'copyright', label: 'Bản quyền nội dung' },
  { value: 'partnership', label: 'Hợp tác' },
] as const

export type ContactTopic = (typeof contactTopics)[number]['value']

export const CONTACT_MESSAGE_MAX = 2000

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Nhập tên của bạn').max(60, 'Tên tối đa 60 ký tự'),
  email: z
    .string()
    .trim()
    .min(1, 'Nhập email để chúng tôi trả lời')
    .pipe(z.email('Nhập email hợp lệ, ví dụ ten@gmail.com')),
  topic: z.enum(contactTopics.map((t) => t.value) as [ContactTopic, ...ContactTopic[]]),
  message: z
    .string()
    .trim()
    .min(10, 'Viết ít nhất 10 ký tự để chúng tôi hiểu rõ')
    .max(CONTACT_MESSAGE_MAX, `Nội dung tối đa ${CONTACT_MESSAGE_MAX} ký tự`),
})

export type ContactValues = z.infer<typeof contactSchema>

export const reportReasons: { value: ReportReason; label: string }[] = [
  { value: 'typo', label: 'Sai chính tả, lỗi đánh máy' },
  { value: 'missing', label: 'Thiếu hoặc lặp nội dung' },
  { value: 'order', label: 'Sai thứ tự chương' },
  { value: 'violation', label: 'Nội dung vi phạm' },
  { value: 'other', label: 'Lỗi khác' },
]

export const REPORT_NOTE_MAX = 500

export const reportSchema = z
  .object({
    reason: z.enum(['typo', 'missing', 'order', 'violation', 'other']),
    note: z.string().trim().max(REPORT_NOTE_MAX, `Ghi chú tối đa ${REPORT_NOTE_MAX} ký tự`),
  })
  .refine((d) => d.reason !== 'other' || d.note.length > 0, {
    path: ['note'],
    message: 'Mô tả ngắn lỗi bạn gặp',
  })

export type ReportValues = z.infer<typeof reportSchema>
