// Giới hạn tần suất của bản giả, cùng mức với trigger của DB (migration rate_limits_and_account_deletion)

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** Số mốc thời gian (ISO) nằm trong `ms` mili giây gần nhất */
export const countSince = (dates: string[], ms: number, now = Date.now()) =>
  dates.filter((d) => now - new Date(d).getTime() < ms).length
