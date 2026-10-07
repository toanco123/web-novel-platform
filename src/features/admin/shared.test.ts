import { addDays, calendarWeeks, heatLevel, periodDelta } from './shared'

test('so với kỳ trước: không có số liệu, mới có, tăng, giảm, gần như không đổi', () => {
  expect(periodDelta(0, 0)).toEqual({ kind: 'none' })
  expect(periodDelta(5, 0)).toEqual({ kind: 'new', diff: 5 })
  expect(periodDelta(150, 100)).toEqual({ kind: 'up', diff: 50, pct: 50 })
  expect(periodDelta(75, 100)).toEqual({ kind: 'down', diff: -25, pct: -25 })
  expect(periodDelta(1002, 1000)).toEqual({ kind: 'flat', diff: 2, pct: 0 })
})

test('dịch ngày qua đầu tháng, đầu năm', () => {
  expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
})

test('lịch nhiệt chia cột 7 ngày, tuần cuối chưa hết thì để trống', () => {
  const calendar = Array.from({ length: 10 }, (_, i) => ({ day: addDays('2026-09-28', i) }))
  const weeks = calendarWeeks(calendar)
  expect(weeks).toHaveLength(2)
  expect(weeks[0].map((d) => d?.day)).toEqual([
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
  ])
  expect(weeks[1].slice(3)).toEqual([null, null, null, null])
})

test('mức đậm của ô: 0 khi không có lượt, cao nhất là 4', () => {
  expect(heatLevel(0, 100)).toBe(0)
  expect(heatLevel(1, 100)).toBe(1)
  expect(heatLevel(50, 100)).toBe(2)
  expect(heatLevel(100, 100)).toBe(4)
  expect(heatLevel(5, 0)).toBe(0)
})
