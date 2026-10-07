import { isSnoozed, SNOOZE_DAYS } from './useAppBanner'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 7)

test('chưa tắt hoặc dữ liệu hỏng thì không tạm ẩn', () => {
  for (const value of [null, undefined, 'abc', Number.NaN, {}]) {
    expect(isSnoozed(value, now)).toBe(false)
  }
})

test(`tắt rồi thì ẩn ${SNOOZE_DAYS} ngày`, () => {
  expect(isSnoozed(now - 29 * DAY, now)).toBe(true)
  expect(isSnoozed(now - 30 * DAY, now)).toBe(false)
})

test('thời điểm tắt ở tương lai (giờ máy bị lệch) thì không ẩn mãi', () => {
  expect(isSnoozed(now + 365 * DAY, now)).toBe(false)
})
