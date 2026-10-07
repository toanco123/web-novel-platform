import { useTheme } from '@/hooks/useTheme'
import { calendarWeeks, formatLongDay, heatLevel } from '../shared'
import { adminColors } from './adminTheme'

const number = new Intl.NumberFormat('vi-VN')
const month = new Intl.DateTimeFormat('vi-VN', { month: 'numeric' })
// Hàng từ thứ Hai; chỉ ghi nhãn cách hàng cho đỡ dày
const WEEKDAYS = ['T2', '', 'T4', '', 'T6', '', '']

/** Lịch nhiệt lượt đọc kiểu GitHub: mỗi cột một tuần (thứ Hai → Chủ nhật), càng đậm càng nhiều */
export function ViewsCalendar({ data }: { data: { day: string; views: number }[] }) {
  const theme = useTheme((s) => s.theme)
  const { heat } = adminColors(theme)
  const weeks = calendarWeeks(data)
  const max = Math.max(0, ...data.map((d) => d.views))
  const fill = (level: number) => (level ? heat[level - 1] : 'transparent')

  return (
    <div className="space-y-3">
      <div
        className="grid gap-[3px] text-[10px] leading-none text-muted-foreground"
        style={{ gridTemplateColumns: `1.5rem repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        {/* Nhãn tháng: ghi ở cột đầu tiên và cột có ngày 1 */}
        <span />
        {weeks.map((week, i) => {
          const first = week.find((d) => d && (i === 0 || d.day.endsWith('-01')))
          return (
            <span key={i} className="truncate pb-1">
              {first ? `Th${month.format(new Date(`${first.day}T00:00`))}` : ''}
            </span>
          )
        })}
        {WEEKDAYS.map((label, row) => (
          <Row key={row} label={label}>
            {weeks.map((week, col) => {
              const d = week[row]
              if (!d) return <span key={col} />
              const level = heatLevel(d.views, max)
              return (
                <span
                  key={col}
                  title={`${formatLongDay(d.day)}: ${number.format(d.views)} lượt đọc`}
                  className="aspect-square rounded-[3px] border border-border"
                  style={{
                    background: fill(level),
                    borderColor: level ? 'transparent' : undefined,
                  }}
                />
              )
            })}
          </Row>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <span className="mr-1">Ít</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="size-3 rounded-[3px] border border-border"
            style={{ background: fill(level), borderColor: level ? 'transparent' : undefined }}
          />
        ))}
        <span className="ml-1">Nhiều</span>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="self-center">{label}</span>
      {children}
    </>
  )
}
