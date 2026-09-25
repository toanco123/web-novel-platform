import { chapterFormSchema, firstChapterSchema } from './schemas'

test('chương 1 trong form tạo truyện: để trống thì bỏ qua, viết dở thì báo lỗi', () => {
  expect(firstChapterSchema.safeParse({ title: '', content: '  ' }).success).toBe(true)
  expect(
    firstChapterSchema.safeParse({ title: '', content: 'Nội dung chương. '.repeat(10) }).success,
  ).toBe(true)

  expect(firstChapterSchema.safeParse({ title: '', content: 'Ngắn quá' }).error?.issues).toEqual([
    expect.objectContaining({
      path: ['content'],
      message: 'Nội dung chương cần ít nhất 100 ký tự',
    }),
  ])
  expect(firstChapterSchema.safeParse({ title: 'Gặp lại', content: '' }).error?.issues).toEqual([
    expect.objectContaining({
      path: ['content'],
      message: 'Viết nội dung chương 1 hoặc xóa tiêu đề chương',
    }),
  ])
})

test('số chương trong trình soạn: số nguyên từ 1, không trùng chương khác', () => {
  const schema = chapterFormSchema([1, 3])
  const base = { title: '', content: 'Nội dung chương. '.repeat(10) }
  const message = (number: number) =>
    schema.safeParse({ ...base, number }).error?.issues[0]?.message

  expect(schema.safeParse({ ...base, number: 2 }).success).toBe(true)
  expect(message(3)).toBe('Chương 3 đã có, chọn số khác')
  expect(message(0)).toBe('Số chương từ 1 trở lên')
  expect(message(2.5)).toBe('Số chương phải là số nguyên')
  expect(message(Number.NaN)).toBe('Nhập số chương')
})
