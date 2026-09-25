import { z } from 'zod'

const email = z
  .string()
  .trim()
  .min(1, 'Nhập email của bạn')
  .pipe(z.email('Nhập email hợp lệ, ví dụ ten@gmail.com'))

const newPassword = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
  .regex(/\p{L}/u, 'Mật khẩu cần có ít nhất một chữ cái')
  .regex(/\d/, 'Mật khẩu cần có ít nhất một chữ số')

const passwordsMatch = (d: { password: string; confirmPassword: string }) =>
  d.password === d.confirmPassword
const mismatch = { path: ['confirmPassword'], message: 'Mật khẩu nhập lại không khớp' }

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Nhập mật khẩu'),
})

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Tên hiển thị cần ít nhất 2 ký tự')
      .max(30, 'Tên hiển thị tối đa 30 ký tự'),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu'),
    acceptTerms: z.boolean().refine((v) => v, 'Bạn cần đồng ý với điều khoản để tạo tài khoản'),
  })
  .refine(passwordsMatch, mismatch)

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu'),
  })
  .refine(passwordsMatch, mismatch)

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

/** 0: chưa nhập, 1: yếu, 2: tạm được, 3: mạnh */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/\p{L}/u.test(password) && /\d/.test(password)) score++
  if (password.length >= 12 || /[^\p{L}\d]/u.test(password)) score++
  return Math.max(1, score) as 1 | 2 | 3
}
