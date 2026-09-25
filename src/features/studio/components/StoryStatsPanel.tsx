import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionError } from '@/components/common/SectionHeading'
import { formatCount } from '@/lib/format'
import type { StoryStats } from '../api'
import { useStoryStats } from '../hooks'

const number = new Intl.NumberFormat('vi-VN')
const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' })
const longDate = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
})
/** "2026-09-25" → Date theo giờ máy (không lệch ngày do múi giờ) */
const parseDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Thống kê một truyện trong khu Sáng tác: ô số, lượt đọc 7 ngày, lượt đọc theo chương */
export function StoryStatsPanel({ storyId, published }: { storyId: string; published: boolean }) {
  const { data, isPending, isError } = useStoryStats(storyId)

  if (isError) return <SectionError />
  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="flex gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {published
          ? 'Mỗi lần bạn đọc mở một chương được tính 1 lượt đọc. Lượt đọc của chính bạn không được tính.'
          : 'Truyện đang là bản nháp nên chưa có ai đọc. Xuất bản để bắt đầu có lượt đọc.'}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Lượt đọc" value={formatCount(data.views)} />
        <StatTile label="7 ngày qua" value={formatCount(data.viewsRecent)} />
        <StatTile label="Người theo dõi" value={formatCount(data.followers)} />
        <StatTile
          label="Đánh giá"
          value={data.ratingCount ? data.ratingAvg.toFixed(1) : '–'}
          hint={data.ratingCount ? `${number.format(data.ratingCount)} lượt chấm` : 'Chưa có'}
        />
        <StatTile label="Bình luận" value={formatCount(data.comments)} />
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <DailyViews days={data.viewsByDay} />
        <ChapterViews chapters={data.viewsByChapter} />
      </div>
    </div>
  )
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card/50 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="rounded-xl border bg-card/50 p-5">
      <figcaption className="font-medium">{title}</figcaption>
      {children}
    </figure>
  )
}

/** Cột lượt đọc từng ngày; nhãn số chỉ ở cột cao nhất và hôm nay, còn lại xem khi rê/focus */
function DailyViews({ days }: { days: StoryStats['viewsByDay'] }) {
  const max = Math.max(...days.map((d) => d.views))
  const peak = days.findIndex((d) => d.views === max)
  const today = days.length - 1

  return (
    <ChartCard title="Lượt đọc 7 ngày qua">
      {max === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Chưa có lượt đọc nào trong 7 ngày qua.</p>
      ) : (
        <>
          <ol className="mt-6 flex h-40 items-end gap-2 border-b" aria-label="Lượt đọc theo ngày">
            {days.map((d, i) => {
              const date = parseDay(d.day)
              const labelled = d.views > 0 && (i === peak || i === today)
              return (
                <li
                  key={d.day}
                  tabIndex={0}
                  aria-label={`${longDate.format(date)}: ${number.format(d.views)} lượt đọc`}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
                >
                  {labelled && (
                    <span className="mb-1 text-xs font-medium tabular-nums">
                      {formatCount(d.views)}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                    style={{ height: d.views ? `max(2px, ${(d.views / max) * 85}%)` : 0 }}
                  />
                  {/* Chú thích khi rê chuột / focus: số trước, ngày sau */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md border bg-popover px-2.5 py-1.5 text-center whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block"
                  >
                    <span className="block text-sm font-semibold tabular-nums">
                      {number.format(d.views)}
                    </span>
                    <span className="text-xs text-muted-foreground">{longDate.format(date)}</span>
                  </span>
                </li>
              )
            })}
          </ol>
          <ol aria-hidden className="mt-2 flex gap-2 text-center text-xs text-muted-foreground">
            {days.map((d, i) => (
              <li key={d.day} className="flex-1">
                {i === today ? 'Hôm nay' : weekday.format(parseDay(d.day))}
                <span className="block text-[0.65rem] opacity-70">
                  {dayMonth.format(parseDay(d.day))}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <TableView>
        <thead>
          <tr>
            <th scope="col">Ngày</th>
            <th scope="col">Lượt đọc</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{longDate.format(parseDay(d.day))}</td>
              <td>{number.format(d.views)}</td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </ChartCard>
  )
}

/** Thanh ngang lượt đọc từng chương (mỗi dòng như một hàng bảng: tên chương, thanh, số) */
function ChapterViews({ chapters }: { chapters: StoryStats['viewsByChapter'] }) {
  const max = Math.max(1, ...chapters.map((c) => c.views))

  return (
    <ChartCard title="Lượt đọc theo chương">
      {chapters.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Chưa có chương nào được xuất bản.</p>
      ) : (
        <div className="relative mt-4 max-h-72 overflow-y-auto pr-1">
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th scope="col">Chương</th>
                <th scope="col">Lượt đọc</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.number}>
                  <th scope="row" className="w-2/5 py-1.5 pr-3 text-left font-normal">
                    <span className="line-clamp-1 text-muted-foreground">
                      Chương {c.number}
                      {c.title && `: ${c.title}`}
                    </span>
                  </th>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-3 rounded-r-[4px] bg-chart-1"
                        style={{ width: c.views ? `max(2px, ${(c.views / max) * 80}%)` : 0 }}
                      />
                      <span className="text-xs tabular-nums">{number.format(c.views)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  )
}

function TableView({ children }: { children: ReactNode }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Xem dạng bảng
      </summary>
      <table className="mt-2 w-full text-left [&_td]:border-t [&_td]:py-1.5 [&_td:last-child]:text-right [&_td:last-child]:tabular-nums [&_th]:py-1.5 [&_th]:font-medium [&_th:last-child]:text-right">
        {children}
      </table>
    </details>
  )
}
