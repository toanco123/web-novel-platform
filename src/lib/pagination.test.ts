import { pageList } from './pagination'

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
