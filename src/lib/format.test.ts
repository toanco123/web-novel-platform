import { formatBytes, formatRelativeTime, formatScheduleShort, formatScheduleTime } from './format'

test('formatRelativeTime', () => {
  const now = Date.parse('2026-09-25T12:00:00Z')
  expect(formatRelativeTime('2026-09-25T11:59:30Z', now)).toBe('vừa xong')
  expect(formatRelativeTime('2026-09-25T11:55:00Z', now)).toBe('5 phút trước')
  expect(formatRelativeTime('2026-09-24T12:00:00Z', now)).toBe('Hôm qua')
})

test('formatBytes', () => {
  expect(formatBytes(0)).toBe('0 KB')
  expect(formatBytes(300)).toBe('1 KB')
  expect(formatBytes(850 * 1024)).toBe('850 KB')
  expect(formatBytes(1.25 * 1024 * 1024)).toBe('1,3 MB')
})

describe('formatScheduleTime', () => {
  const at = (d: number, h: number, min = 0) => new Date(2026, 9, d, h, min)
  // Thứ Tư 07/10/2026, 10:00
  const now = at(7, 10).getTime()

  test('hôm nay, ngày mai, ngày khác (kèm thứ)', () => {
    expect(formatScheduleTime(at(7, 20).toISOString(), now)).toBe('20:00 hôm nay')
    expect(formatScheduleTime(at(8, 8, 5).toISOString(), now)).toBe('08:05 ngày mai')
    expect(formatScheduleTime(at(9, 20).toISOString(), now)).toBe('20:00 thứ Sáu, 09/10')
    expect(formatScheduleTime(at(11, 20).toISOString(), now)).toBe('20:00 Chủ nhật, 11/10')
  })

  test('dạng ngắn cho huy hiệu', () => {
    expect(formatScheduleShort(at(9, 20).toISOString())).toBe('20:00 · T6, 09/10')
    expect(formatScheduleShort(at(11, 7, 30).toISOString())).toBe('07:30 · CN, 11/10')
  })
})
