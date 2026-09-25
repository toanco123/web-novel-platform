import { pageList, paginate } from './pagination'

test.each([
  [1, 1, [1]],
  [1, 3, [1, 2, 3]],
  [1, 9, [1, 2, '…', 9]],
  [5, 9, [1, '…', 4, 5, 6, '…', 9]],
  [3, 9, [1, 2, 3, 4, '…', 9]],
  [9, 9, [1, '…', 8, 9]],
])('pageList(%i, %i)', (current, total, expected) => {
  expect(pageList(current, total)).toEqual(expected)
})

test('paginate cắt đúng trang và kẹp số trang ngoài khoảng', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1)
  expect(paginate(items, 2, 10)).toEqual({
    items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    total: 25,
    page: 2,
    pageCount: 3,
  })
  expect(paginate(items, 99, 10).page).toBe(3)
  expect(paginate(items, 0, 10).page).toBe(1)
  expect(paginate([], 1, 10)).toEqual({ items: [], total: 0, page: 1, pageCount: 1 })
})
