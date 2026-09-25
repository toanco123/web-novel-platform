import { formatRelativeTime } from './format'

test('formatRelativeTime', () => {
  const now = Date.parse('2026-09-25T12:00:00Z')
  expect(formatRelativeTime('2026-09-25T11:59:30Z', now)).toBe('vừa xong')
  expect(formatRelativeTime('2026-09-25T11:55:00Z', now)).toBe('5 phút trước')
  expect(formatRelativeTime('2026-09-24T12:00:00Z', now)).toBe('Hôm qua')
})
