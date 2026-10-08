const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const relative = new Intl.RelativeTimeFormat('vi-VN', { numeric: 'auto' })

/** 1234567 → "1,2 Tr" */
export function formatCount(value: number) {
  return compact.format(value)
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** ISO date → "5 phút trước", "hôm qua"... */
export function formatRelativeTime(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'vừa xong'
}

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** ISO date → "25/09/2026" */
export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso))
}

const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

/** Dung lượng: 870400 → "850 KB", 1310720 → "1,3 MB" */
export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${decimal.format(bytes / (1024 * 1024))} MB`
}

const clock = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
// Intl vi-VN ghép ngày và tháng bằng "-", nên tự ghép "dd/MM"
const two = (n: number) => String(n).padStart(2, '0')
const dayMonth = { format: (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}` }
const WEEKDAYS = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy']
const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Số ngày lịch (theo giờ của máy) từ `now` tới `date` */
function calendarDaysFrom(date: Date, now: number) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((startOf(date) - startOf(new Date(now))) / 86_400_000)
}

/** Giờ chương hẹn ra: "20:00 hôm nay", "20:00 ngày mai", "20:00 thứ Sáu, 09/10" */
export function formatScheduleTime(iso: string, now = Date.now()) {
  const date = new Date(iso)
  const days = calendarDaysFrom(date, now)
  const time = clock.format(date)
  if (days === 0) return `${time} hôm nay`
  if (days === 1) return `${time} ngày mai`
  return `${time} ${WEEKDAYS[date.getDay()]}, ${dayMonth.format(date)}`
}

/** Dạng ngắn cho huy hiệu: "20:00 · T6, 09/10" */
export function formatScheduleShort(iso: string) {
  const date = new Date(iso)
  return `${clock.format(date)} · ${WEEKDAYS_SHORT[date.getDay()]}, ${dayMonth.format(date)}`
}
