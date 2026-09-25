import { firstChapterSchema } from './schemas'

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
