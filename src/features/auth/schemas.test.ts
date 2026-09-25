import { loginSchema, passwordStrength, registerSchema } from './schemas'

const valid = {
  displayName: '  Linh  ',
  email: 'linh@gmail.com',
  password: 'matkhau123',
  confirmPassword: 'matkhau123',
  acceptTerms: true,
}

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message

test('đăng ký hợp lệ và bỏ khoảng trắng thừa ở tên', () => {
  const result = registerSchema.safeParse(valid)
  expect(result.success).toBe(true)
  expect(result.data?.displayName).toBe('Linh')
})

test('email sai định dạng', () => {
  expect(firstError(loginSchema.safeParse({ email: 'linh@', password: 'x' }))).toBe(
    'Nhập email hợp lệ, ví dụ ten@gmail.com',
  )
})

test('mật khẩu yếu', () => {
  expect(
    firstError(registerSchema.safeParse({ ...valid, password: 'abc', confirmPassword: 'abc' })),
  ).toBe('Mật khẩu cần ít nhất 8 ký tự')
  expect(
    firstError(
      registerSchema.safeParse({ ...valid, password: 'chichuthoi', confirmPassword: 'chichuthoi' }),
    ),
  ).toBe('Mật khẩu cần có ít nhất một chữ số')
})

test('mật khẩu nhập lại không khớp', () => {
  const result = registerSchema.safeParse({ ...valid, confirmPassword: 'khac12345' })
  expect(result.error?.issues[0]).toMatchObject({
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })
})

test('chưa đồng ý điều khoản', () => {
  expect(firstError(registerSchema.safeParse({ ...valid, acceptTerms: false }))).toBe(
    'Bạn cần đồng ý với điều khoản để tạo tài khoản',
  )
})

test('độ mạnh mật khẩu', () => {
  expect(passwordStrength('')).toBe(0)
  expect(passwordStrength('abc')).toBe(1)
  expect(passwordStrength('matkhau123')).toBe(2)
  expect(passwordStrength('matkhau123!')).toBe(3)
})
