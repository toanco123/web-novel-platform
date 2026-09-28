import { genreSchema } from './schemas'

const checkName = (name: string) => genreSchema.shape.name.safeParse(name)

test.each(['仙侠', 'Русский', 'ææ'])('tên không ra được slug thì báo lỗi: %j', (name) => {
  const result = checkName(name)
  expect(result.success).toBe(false)
  expect(result.error?.issues[0].message).toBe('Tên cần có chữ cái Latin hoặc số')
})

test.each(['Ngôn tình', 'Đô thị', 'Æther', 'Tiên hiệp 仙侠', '18'])(
  'tên có chữ a–z (có dấu) hoặc số thì hợp lệ: %j',
  (name) => expect(checkName(name).success).toBe(true),
)

test('lỗi độ dài, ký tự vẫn báo trước', () => {
  expect(checkName('仙').error?.issues[0].message).toBe('Tên thể loại cần ít nhất 2 ký tự')
  expect(checkName('@@').error?.issues[0].message).toBe(
    'Tên chỉ gồm chữ, số, khoảng trắng và - / &',
  )
})
