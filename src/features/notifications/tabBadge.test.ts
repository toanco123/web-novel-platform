import { stripCount, withCount } from './tabBadge'

test('tiêu đề tab kèm số chưa đọc, gắn lại nhiều lần vẫn một tiền tố', () => {
  expect(withCount('Truyện hay | Web', 2)).toBe('(2) Truyện hay | Web')
  expect(withCount('(2) Truyện hay | Web', 5)).toBe('(5) Truyện hay | Web')
  expect(withCount('(5) Truyện hay | Web', 0)).toBe('Truyện hay | Web')
  expect(withCount('Truyện hay', 120)).toBe('(99+) Truyện hay')
  expect(stripCount('(99+) Truyện hay')).toBe('Truyện hay')
  // Tiêu đề có sẵn dấu ngoặc số ở giữa không bị đụng
  expect(stripCount('Chương (3) kết')).toBe('Chương (3) kết')
})
