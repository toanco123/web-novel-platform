import { estimatedPixelsPerWord, pixelsPerSecond, pixelsPerWord, stepSpeed } from './pace'
import { AUTO_SCROLL_SPEEDS } from './useAutoScrollSettings'

test('1× là đọc kịp 220 chữ/phút; tốc độ gấp đôi thì cuộn nhanh gấp đôi', () => {
  expect(pixelsPerSecond(3, 1)).toBeCloseTo(11) // 3 px/chữ × 220 chữ/phút = 11 px/giây
  expect(pixelsPerSecond(3, 2)).toBeCloseTo(22)
})

test('đổi tốc độ theo từng nấc, dừng ở hai đầu', () => {
  expect(stepSpeed(1, 1)).toBe(1.25)
  expect(stepSpeed(1, -1)).toBe(0.75)
  expect(stepSpeed(AUTO_SCROLL_SPEEDS[0], -1)).toBe(AUTO_SCROLL_SPEEDS[0])
  expect(stepSpeed(3, 1)).toBe(3)
  // Giá trị lạ (dữ liệu cũ) thì tính từ 1×
  expect(stepSpeed(1.1, 1)).toBe(1.25)
})

test('số px mỗi chữ đo từ bố cục thật; không đo được thì dùng ước lượng', () => {
  const article = document.createElement('article')
  article.innerHTML = '<p data-paragraph="0">một hai ba bốn</p><p data-paragraph="1">năm sáu</p>'
  // jsdom không có bố cục (chiều cao 0)
  expect(pixelsPerWord(article, 7)).toBe(7)
  expect(pixelsPerWord(null, 7)).toBe(7)

  const [first, last] = article.querySelectorAll('p')
  vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
  vi.spyOn(last, 'getBoundingClientRect').mockReturnValue({ bottom: 160 } as DOMRect)
  expect(pixelsPerWord(article, 7)).toBe(10) // 60 px cho 6 chữ
  expect(estimatedPixelsPerWord(20, 2)).toBe(4)
})
