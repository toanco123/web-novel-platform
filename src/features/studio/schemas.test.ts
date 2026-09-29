import { chapterFormSchema, firstChapterSchema } from './schemas'

test('chương đầu tiên trong form tạo truyện: để trống thì bỏ qua, viết dở thì báo lỗi', () => {
  const long = 'Nội dung chương. '.repeat(10)
  expect(firstChapterSchema.safeParse({ number: 1, title: '', content: '  ' }).success).toBe(true)
  expect(firstChapterSchema.safeParse({ number: 50, title: '', content: long }).success).toBe(true)
  // Không viết chương thì ô số chương bỏ trống cũng không sao
  expect(firstChapterSchema.safeParse({ number: Number.NaN, title: '', content: '' }).success).toBe(
    true,
  )

  const numberMessage = (number: number) =>
    firstChapterSchema.safeParse({ number, title: '', content: long }).error?.issues[0]?.message
  expect(numberMessage(Number.NaN)).toBe('Nhập số chương')
  expect(numberMessage(0)).toBe('Số chương từ 1 trở lên')

  expect(
    firstChapterSchema.safeParse({ number: 1, title: '', content: 'Ngắn quá' }).error?.issues,
  ).toEqual([
    expect.objectContaining({
      path: ['content'],
      message: 'Nội dung chương cần ít nhất 100 ký tự',
    }),
  ])
  expect(
    firstChapterSchema.safeParse({ number: 1, title: 'Gặp lại', content: '' }).error?.issues,
  ).toEqual([
    expect.objectContaining({
      path: ['content'],
      message: 'Viết nội dung chương hoặc xóa tiêu đề chương',
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

test('nội dung có định dạng: đếm độ dài trên chữ nhìn thấy và lưu HTML đã làm sạch', () => {
  const schema = chapterFormSchema([])
  const words = 'Nội dung chương. '.repeat(5)
  // 85 ký tự chữ, thẻ định dạng không được tính cho đủ 100
  expect(
    schema.safeParse({ number: 1, title: '', content: `<p><strong>${words}</strong></p>` }).error
      ?.issues[0]?.message,
  ).toBe('Nội dung chương cần ít nhất 100 ký tự')

  const long = 'Nội dung chương. '.repeat(10)
  expect(
    schema.parse({
      number: 1,
      title: '',
      content: `<p onclick="x()"><b>${long}</b><script>alert(1)</script></p><p></p>`,
    }).content,
  ).toBe(`<p><strong>${long.trim()}</strong></p>`)
  // Văn bản thuần (vd dán từ bản cũ) cũng được đổi sang HTML
  expect(schema.parse({ number: 1, title: '', content: long }).content).toBe(
    `<p>${long.trim()}</p>`,
  )
})
