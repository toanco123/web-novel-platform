import { Star } from 'lucide-react'
import type { RatingSummary as Summary, Score } from '@/types/comment'

const scores: Score[] = [5, 4, 3, 2, 1]
const number = new Intl.NumberFormat('vi-VN')

export function RatingSummary({ summary }: { summary: Summary }) {
  if (summary.count === 0) {
    return (
      <div>
        <p className="font-heading text-2xl font-semibold">Chưa có đánh giá</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hãy là người đầu tiên chấm điểm truyện này.
        </p>
      </div>
    )
  }
  const max = Math.max(1, ...scores.map((s) => summary.distribution[s]))
  return (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <p className="font-heading text-6xl leading-none font-semibold lining-nums">
          {summary.average.toFixed(1)}
        </p>
        <StarRow value={summary.average} />
        <p className="mt-1 text-xs text-muted-foreground">
          {number.format(summary.count)} lượt đánh giá
        </p>
      </div>
      <dl className="min-w-0 flex-1 space-y-1.5">
        {scores.map((s) => {
          const count = summary.distribution[s]
          const percent = summary.count ? Math.round((count / summary.count) * 100) : 0
          return (
            <div key={s} className="flex items-center gap-2 text-xs">
              <dt className="flex w-7 shrink-0 items-center gap-0.5 text-muted-foreground tabular-nums">
                {s} <Star className="size-3 fill-current" aria-hidden />
                <span className="sr-only">sao</span>
              </dt>
              <dd className="flex flex-1 items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-rose-gold"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right text-muted-foreground tabular-nums">
                  {percent}%
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="mt-2 flex justify-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= Math.round(value)
              ? 'size-4 fill-rose-gold text-rose-gold'
              : 'size-4 text-muted-foreground/50'
          }
        />
      ))}
    </div>
  )
}
