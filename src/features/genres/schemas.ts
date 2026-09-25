import { z } from 'zod'

export const genreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên thể loại cần ít nhất 2 ký tự')
    .max(30, 'Tên thể loại tối đa 30 ký tự')
    .regex(/^[\p{L}\d][\p{L}\d\s\-/&]*$/u, 'Tên chỉ gồm chữ, số, khoảng trắng và - / &'),
  description: z.string().trim().max(200, 'Mô tả tối đa 200 ký tự'),
})

export type GenreValues = z.infer<typeof genreSchema>
