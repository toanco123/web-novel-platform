import { parseChapters } from './parseChapters'

const body = (n: number) => `Nội dung chương ${n}. `.repeat(10)

test('nhận nhiều dạng tiêu đề, CRLF và BOM', () => {
  const file =
    '﻿Chương 1: Gặp lại\r\n' +
    body(1) +
    '\r\n\r\n\r\nCHƯƠNG 2 - Mưa đầu mùa\r\n' +
    body(2) +
    '\r\nChuong 3. Hiểu lầm\r\n' +
    body(3) +
    '\r\nChương 4\r\n' +
    body(4)
  const { chapters, warnings } = parseChapters(file)
  expect(chapters.map((c) => [c.sourceNumber, c.title])).toEqual([
    [1, 'Gặp lại'],
    [2, 'Mưa đầu mùa'],
    [3, 'Hiểu lầm'],
    [4, ''],
  ])
  expect(chapters[0].content).toBe(body(1).trim())
  expect(chapters.every((c) => c.problem === null)).toBe(true)
  expect(warnings).toEqual([])
})

test('bỏ qua đoạn mở đầu và cảnh báo', () => {
  const { chapters, warnings } = parseChapters(
    `Lời tác giả: cảm ơn mọi người.\n\nChương 1: A\n${body(1)}`,
  )
  expect(chapters).toHaveLength(1)
  expect(warnings[0]).toMatch(/trước chương đầu tiên/)
})

test('không có tiêu đề thì cả file thành 1 chương', () => {
  const { chapters, warnings } = parseChapters(body(1))
  expect(chapters).toEqual([
    { sourceNumber: null, title: '', content: body(1).trim(), problem: null },
  ])
  expect(warnings[0]).toMatch(/Không tìm thấy dòng tiêu đề/)
})

test('cảnh báo số chương lặp, nhảy cóc và chương quá ngắn', () => {
  const { chapters, warnings } = parseChapters(
    `Chương 1: A\n${body(1)}\nChương 1: A lặp\n${body(1)}\nChương 5: B\nngắn`,
  )
  expect(chapters.at(-1)?.problem).toMatch(/Quá ngắn/)
  expect(warnings.join('\n')).toMatch(/lặp trong file: 1/)
  expect(warnings.join('\n')).toMatch(/không liền mạch \(1 → 5\)/)
  expect(warnings.join('\n')).toMatch(/1 chương quá ngắn hoặc quá dài/)
})

test('dòng có chữ "chương" giữa câu không bị coi là tiêu đề', () => {
  const { chapters } = parseChapters(`Chương 1: A\nCô ấy đọc chương 2 của cuốn sách. ${body(1)}`)
  expect(chapters).toHaveLength(1)
})
