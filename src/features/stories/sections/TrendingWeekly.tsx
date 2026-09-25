import { Trophy } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError, SectionHeading } from '@/components/common/SectionHeading'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { useTrendingWeekly } from '../hooks'
import { StoryCover } from '../StoryCover'

const rankColor = ['text-neon', 'text-rose-gold', 'text-rose-gold/80']

export function TrendingWeekly() {
  const { data, isPending, isError } = useTrendingWeekly()

  return (
    <section aria-labelledby="trending-weekly">
      <SectionHeading
        id="trending-weekly"
        icon={<Trophy className="size-5 text-rose-gold" aria-hidden />}
        moreTo={paths.ranking}
      >
        Top tuần
      </SectionHeading>
      {isError ? (
        <SectionError />
      ) : (
        <ol className="grid gap-1 md:grid-cols-2 md:gap-x-6 lg:grid-cols-1">
          {isPending
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))
            : data.map(({ story: s, value }, i) => (
                <li key={s.slug}>
                  <Link
                    to={paths.story(s.slug)}
                    className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        'w-7 shrink-0 text-center font-heading text-3xl leading-none font-semibold lining-nums tabular-nums',
                        rankColor[i] ?? 'text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </span>
                    <StoryCover story={s} compact className="w-10 shrink-0 rounded" />
                    <span className="min-w-0">
                      <span className="line-clamp-1 text-sm font-medium group-hover:text-primary">
                        {s.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCount(value)} lượt đọc tuần này
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
        </ol>
      )}
    </section>
  )
}
