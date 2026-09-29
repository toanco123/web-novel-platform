import { formatBytes, formatRelativeTime } from './format'

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
