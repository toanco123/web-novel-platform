import { slugify } from './slugify'

test.each([
  ['Ngôn tình', 'ngon-tinh'],
  ['  Ngôn   Tình  ', 'ngon-tinh'],
  ['ngon tinh', 'ngon-tinh'],
  ['Đô Thị Đặc Sắc', 'do-thi-dac-sac'],
  ['Trường An Không Tuyết!!!', 'truong-an-khong-tuyet'],
  ['Thập niên 80', 'thap-nien-80'],
  ['Hệ thống / Xuyên nhanh', 'he-thong-xuyen-nhanh'],
  ['!!!', ''],
])('slugify(%j) = %j', (input, expected) => {
  expect(slugify(input)).toBe(expected)
})
