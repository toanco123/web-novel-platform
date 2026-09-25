import { browseSearch, parseBrowseParams } from './browseParams'

test('đọc bộ lọc từ URL, giá trị lạ thì bỏ qua', () => {
  expect(
    parseBrowseParams(
      new URLSearchParams('the-loai=co-dai&do-dai=dai&sap-xep=doc-nhieu&trang=3&trang-thai=xyz'),
    ),
  ).toEqual({ status: undefined, genre: 'co-dai', length: 'long', sort: 'views', page: 3 })
  expect(parseBrowseParams(new URLSearchParams('trang=abc'))).toMatchObject({
    sort: 'updated',
    page: 1,
  })
})

test('ghi bộ lọc ra URL, bỏ giá trị mặc định', () => {
  expect(browseSearch({ sort: 'updated', page: 1 })).toBe('')
  expect(browseSearch({ status: 'completed', length: 'short', sort: 'rating', page: 2 })).toBe(
    '?trang-thai=hoan-thanh&do-dai=ngan&sap-xep=danh-gia&trang=2',
  )
})

test('ghi rồi đọc lại ra đúng bộ lọc', () => {
  const filters = { genre: 'ngon-tinh', length: 'medium', sort: 'newest', page: 4 } as const
  expect(parseBrowseParams(new URLSearchParams(browseSearch(filters)))).toEqual({
    status: undefined,
    ...filters,
  })
})
