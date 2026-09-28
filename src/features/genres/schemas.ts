import { z } from 'zod'
import { slugify } from '@/lib/slugify'

export const genreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên thể loại cần ít nhất 2 ký tự')
    .max(30, 'Tên thể loại tối đa 30 ký tự')
    .regex(/^[\p{L}\d][\p{L}\d\s\-/&]*$/u, 'Tên chỉ gồm chữ, số, khoảng trắng và - / &')
    // Slug (đường dẫn, khóa chặn trùng) chỉ giữ a–z, 0–9: tên toàn chữ Hán, Kirin... ra slug rỗng
    .refine((name) => slugify(name) !== '', 'Tên cần có chữ cái Latin hoặc số'),
  description: z.string().trim().max(200, 'Mô tả tối đa 200 ký tự'),
})

export type GenreValues = z.infer<typeof genreSchema>
