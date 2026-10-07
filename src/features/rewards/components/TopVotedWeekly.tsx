import { CalendarCheck, Ticket } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError, SectionHeading } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/hooks'
import { useRanking } from '@/features/stories/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { TOP_VOTED_LIMIT } from '../api'
import { useRewardStatus } from '../hooks'
import { RewardBloom } from './RewardBloom'

const rankColor = ['text-neon', 'text-rose-gold', 'text-rose-gold']

/**
 * Khối "Đề cử tuần" ở cột phải trang chủ: top truyện theo phiếu đề cử 7 ngày (dùng chung cache với
 * /ranking?by=votes) và ô mời điểm danh.
 */
export function TopVotedWeekly() {
  const { data, isPending, isError } = useRanking('votes', 'week')
  const items = data?.slice(0, TOP_VOTED_LIMIT) ?? []

  return (
    <section aria-labelledby="top-voted-weekly">
      <SectionHeading
        id="top-voted-weekly"
        icon={<Ticket className="size-5 text-neon" aria-hidden />}
        moreTo={paths.rankingVotes}
      >
        Đề cử tuần
      </SectionHeading>
      {isError ? (
        <SectionError />
      ) : !isPending && items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Chưa có truyện nào được đề cử tuần này.
        </p>
      ) : (
        <ol className="grid gap-1 md:grid-cols-2 md:gap-x-6 lg:grid-cols-1">
          {isPending
            ? Array.from({ length: TOP_VOTED_LIMIT }, (_, i) => (
                <li key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-7 w-7 shrink-0" />
                  <Skeleton className="aspect-[2/3] w-10 shrink-0 rounded" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="my-0.5 h-4 w-3/4" />
                    <Skeleton className="my-0.5 h-3 w-1/2" />
                  </div>
                </li>
              ))
            : items.map(({ story: s, value }, i) => (
                <li key={s.slug}>
                  <Link
                    to={paths.story(s.slug)}
                    className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        'w-7 shrink-0 text-center font-heading leading-none font-semibold lining-nums tabular-nums',
                        i < 3 ? 'text-3xl' : 'text-2xl',
                        rankColor[i] ?? 'text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </span>
                    <StoryCover story={s} compact className="w-10 shrink-0 rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium group-hover:text-primary">
                        {s.title}
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {s.genres[0]?.name ?? s.author.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold text-rose-gold tabular-nums">
                        {formatCount(value)}
                      </span>
                      <span className="block text-[0.7rem] text-muted-foreground">phiếu</span>
                    </span>
                  </Link>
                </li>
              ))}
        </ol>
      )}
      <CheckInInvite />
    </section>
  )
}

/** Mời điểm danh: khách thì sang đăng nhập; đã điểm danh hôm nay thì ẩn */
function CheckInInvite() {
  const { data: user, isPending: sessionPending } = useSession()
  const { data: status } = useRewardStatus()
  const current = useCurrentPath()
  if (sessionPending || status?.checkedInToday) return null

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-secondary p-4">
      <p className="flex items-center gap-2.5 text-sm leading-snug">
        <RewardBloom className="size-6" />
        Điểm danh mỗi ngày để có phiếu đề cử truyện bạn thích.
      </p>
      <Button asChild className="h-11 w-full rounded-full font-semibold">
        <Link to={user ? paths.rewards : paths.login(current)}>
          <CalendarCheck aria-hidden />
          {user ? 'Điểm danh hôm nay' : 'Đăng nhập để điểm danh'}
        </Link>
      </Button>
    </div>
  )
}
