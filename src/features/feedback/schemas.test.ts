// Giới hạn của form liên hệ phải khớp check của bảng contact_messages (char_length đếm theo ký tự
// Unicode), không thì form cho gửi mà database từ chối
import { contactSchema } from './schemas'

const valid = {
  name: 'Lan',
  email: 'lan@gmail.com',
  topic: 'general',
  message: 'Trang tìm kiếm bị lỗi.',
} as const

const firstError = (values: Partial<Record<keyof typeof valid, string>>) =>
  contactSchema.safeParse({ ...valid, ...values }).error?.issues[0]?.message

test('email tối đa 254 ký tự như cột email của database', () => {
  expect(firstError({ email: 'a'.repeat(249) + '@b.co' })).toBeUndefined()
  expect(firstError({ email: 'a'.repeat(250) + '@b.co' })).toBe('Email tối đa 254 ký tự')
})

test('độ dài đếm theo ký tự Unicode như char_length: emoji tính là 1 ký tự', () => {
  expect(firstError({ name: '😀' })).toBe('Nhập tên của bạn')
  expect(firstError({ name: '😀😀' })).toBeUndefined()
  expect(firstError({ message: 'Hay quá 👍' })).toBe('Viết ít nhất 10 ký tự để chúng tôi hiểu rõ')
})
