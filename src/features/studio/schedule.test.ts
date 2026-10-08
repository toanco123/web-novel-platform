import { fromLocalInputs, planSchedule, scheduleProblem, toLocalInputs } from './shared'

// Mốc giờ địa phương: test đúng ở mọi múi giờ
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)
const iso = (...args: Parameters<typeof at>) => at(...args).toISOString()
// Thứ Tư 07/10/2026, 10:00
const NOW = at(2026, 10, 7, 10).getTime()
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

test('mỗi ngày một chương, bắt đầu từ ngày đã chọn, theo thứ tự số chương', () => {
  expect(
    planSchedule(
      [5, 6, 7],
      { start: '2026-10-08', time: '20:00', weekdays: EVERY_DAY, perSlot: 1 },
      NOW,
    ),
  ).toEqual([
    { number: 5, scheduledAt: iso(2026, 10, 8, 20) },
    { number: 6, scheduledAt: iso(2026, 10, 9, 20) },
    { number: 7, scheduledAt: iso(2026, 10, 10, 20) },
  ])
})

test('các thứ đã chọn, mỗi lần 2 chương; ngày bắt đầu không đúng thứ thì sang thứ gần nhất', () => {
  // Thứ 2, 4, 6; bắt đầu Chủ nhật 11/10
  const plan = planSchedule(
    [1, 2, 3, 4, 5],
    { start: '2026-10-11', time: '08:30', weekdays: [1, 3, 5], perSlot: 2 },
    NOW,
  )
  expect(plan).toEqual([
    { number: 1, scheduledAt: iso(2026, 10, 12, 8, 30) },
    { number: 2, scheduledAt: iso(2026, 10, 12, 8, 30) },
    { number: 3, scheduledAt: iso(2026, 10, 14, 8, 30) },
    { number: 4, scheduledAt: iso(2026, 10, 14, 8, 30) },
    { number: 5, scheduledAt: iso(2026, 10, 16, 8, 30) },
  ])
})

test('giờ đăng hôm nay đã qua (hoặc chưa đủ 1 phút) thì sang lần kế tiếp', () => {
  const rule = { start: '2026-10-07', weekdays: EVERY_DAY, perSlot: 1 }
  expect(planSchedule([1], { ...rule, time: '09:00' }, NOW)).toEqual([
    { number: 1, scheduledAt: iso(2026, 10, 8, 9) },
  ])
  expect(planSchedule([1], { ...rule, time: '10:00' }, NOW)[0].scheduledAt).toBe(
    iso(2026, 10, 8, 10),
  )
  expect(planSchedule([1], { ...rule, time: '10:05' }, NOW)[0].scheduledAt).toBe(
    iso(2026, 10, 7, 10, 5),
  )
})

test('không chọn thứ nào thì không xếp được', () => {
  expect(
    planSchedule([1, 2], { start: '2026-10-08', time: '20:00', weekdays: [], perSlot: 1 }, NOW),
  ).toEqual([])
})

test('giờ hẹn phải sau ít nhất 1 phút và trong vòng 365 ngày', () => {
  expect(scheduleProblem(new Date(NOW + 30_000).toISOString(), NOW)).toBe('too_soon')
  expect(scheduleProblem(new Date(NOW - 60_000).toISOString(), NOW)).toBe('too_soon')
  expect(scheduleProblem(new Date(NOW + 2 * 60_000).toISOString(), NOW)).toBeNull()
  expect(scheduleProblem(new Date(NOW + 365 * 86_400_000).toISOString(), NOW)).toBeNull()
  expect(scheduleProblem(new Date(NOW + 366 * 86_400_000).toISOString(), NOW)).toBe('too_late')
})

test('đổi qua lại giữa ISO và giá trị ô ngày, ô giờ (giờ của máy)', () => {
  expect(toLocalInputs(iso(2026, 10, 9, 20, 5))).toEqual({ date: '2026-10-09', time: '20:05' })
  expect(fromLocalInputs('2026-10-09', '20:05')).toBe(iso(2026, 10, 9, 20, 5))
  expect(fromLocalInputs('', '20:05')).toBeNull()
  expect(fromLocalInputs('2026-10-09', '')).toBeNull()
})
