import { Trophy } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { SectionError } from '@/components/common/SectionHeading'
import { SegmentedLinks } from '@/components/common/SegmentedLinks'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RANKING_LIMIT,
  type RankedStory,
  type RankingCriterion,
  type RankingPeriod,
} from '@/features/stories/api'
import { useRanking } from '@/features/stories/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Seo } from '@/components/common/Seo'
import { staticPageSeo } from '@/lib/seo'

const criteria: { value: RankingCriterion; param: string; label: string; hint: string }[] = [
  {
    value: 'views',
    param: 'views',
    label: 'Đọc nhiều',
    hint: 'Xếp theo lượt đọc chương trong kỳ.',
  },
  {
    value: 'votes',
    param: 'votes',
    label: 'Đề cử',
    hint: 'Xếp theo số phiếu đề cử độc giả dành cho truyện trong kỳ.',
  },
  {
    value: 'rating',
    param: 'rating',
    label: 'Điểm cao',
    hint: 'Xếp theo điểm, có tính cả số lượt chấm để truyện ít lượt chấm không lên đầu.',
  },
  {
    value: 'follows',
    param: 'follows',
    label: 'Theo dõi nhiều',
    hint: 'Xếp theo số người thêm truyện vào tủ.',
  },
]

const periods: { value: RankingPeriod; param: string; label: string }[] = [
  { value: 'week', param: 'week', label: 'Tuần' },
  { value: 'month', param: 'month', label: 'Tháng' },
  { value: 'all', param: 'all', label: 'Mọi lúc' },
]

const rankColor = ['text-neon', 'text-rose-gold', 'text-rose-gold/80']

export default function RankingPage() {
  const [params] = useSearchParams()
  const criterion = criteria.find((c) => c.param === params.get('by')) ?? criteria[0]
  const period = periods.find((p) => p.param === params.get('period')) ?? periods[0]
  const { data, isPending, isError, isPlaceholderData } = useRanking(criterion.value, period.value)

  const search = (by: string, period?: string) => {
    const next = new URLSearchParams()
    if (by !== criteria[0].param) next.set('by', by)
    if (period && period !== periods[0].param) next.set('period', period)
    const s = next.toString()
    return s ? `?${s}` : ''
  }

  return (
    <Container className="py-10">
      <Seo {...staticPageSeo(paths.ranking)} />
      <h1 className="flex items-center gap-3 font-heading text-4xl font-semibold">
        <Trophy className="size-8 text-rose-gold" aria-hidden />
        Bảng xếp hạng
      </h1>
      <p className="mt-1 text-muted-foreground">{criterion.hint}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SegmentedLinks
          label="Tiêu chí xếp hạng"
          replace
          preventScrollReset
          items={criteria.map((c) => ({
            key: c.param,
            to: { search: search(c.param, period.param) },
            label: c.label,
            active: c === criterion,
          }))}
        />
        {(criterion.value === 'views' || criterion.value === 'votes') && (
          <SegmentedLinks
            label="Kỳ xếp hạng"
            replace
            preventScrollReset
            items={periods.map((p) => ({
              key: p.param,
              to: { search: search(criterion.param, p.param) },
              label: p.label,
              active: p === period,
            }))}
          />
        )}
      </div>

      <div className="mt-8">
        {isError ? (
          <SectionError />
        ) : data?.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Chưa có số liệu cho bảng xếp hạng này.
          </p>
        ) : (
          <ol
            aria-busy={isPending || isPlaceholderData}
            className={cn(
              'divide-y rounded-xl border bg-card/40',
              isPlaceholderData && 'opacity-60 transition-opacity',
            )}
          >
            {isPending
              ? Array.from({ length: RANKING_LIMIT }, (_, i) => (
                  // Cùng lưới với RankingRow: chiều cao dòng do bìa quyết định (w-12 / sm:w-14)
                  <li
                    key={i}
                    className="grid grid-cols-[2.25rem_3rem_minmax(0,1fr)] items-center gap-3 p-3 sm:grid-cols-[3rem_3.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:p-4"
                  >
                    <Skeleton className="mx-auto h-8 w-6" />
                    <Skeleton className="aspect-[2/3] rounded" />
                    <div className="min-w-0">
                      <Skeleton className="my-1 h-4 w-2/3 sm:h-5" />
                      <Skeleton className="my-0.5 h-4 w-1/2" />
                      <Skeleton className="mt-1 h-4 w-24 sm:hidden" />
                    </div>
                    <div className="hidden w-20 sm:block">
                      <Skeleton className="ml-auto h-6 w-16" />
                      <Skeleton className="mt-1 ml-auto h-3 w-14" />
                    </div>
                  </li>
                ))
              : data.map((item, i) => (
                  <li key={item.story.slug}>
                    <RankingRow item={item} rank={i + 1} criterion={criterion.value} />
                  </li>
                ))}
          </ol>
        )}
      </div>
    </Container>
  )
}

function RankingRow({
  item: { story, value },
  rank,
  criterion,
}: {
  item: RankedStory
  rank: number
  criterion: RankingCriterion
}) {
  const metric =
    criterion === 'rating'
      ? { value: `${value.toFixed(1)} ★`, unit: `${formatCount(story.ratingCount)} lượt chấm` }
      : {
          value: formatCount(value),
          unit: { views: 'lượt đọc', votes: 'phiếu', follows: 'theo dõi' }[criterion],
        }

  return (
    <div
      className={cn(
        'relative grid grid-cols-[2.25rem_3rem_minmax(0,1fr)] items-center gap-3 p-3 transition-colors hover:bg-muted/40 sm:grid-cols-[3rem_3.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:p-4',
        rank <= 3 && 'bg-primary/[0.03]',
      )}
    >
      <span
        className={cn(
          'text-center font-heading text-3xl leading-none font-semibold lining-nums tabular-nums sm:text-4xl',
          rankColor[rank - 1] ?? 'text-muted-foreground',
        )}
      >
        {rank}
      </span>
      <div className="overflow-hidden rounded ring-1 ring-border">
        <StoryCover story={story} compact />
      </div>
      <div className="min-w-0">
        <Link
          to={paths.story(story.slug)}
          className="line-clamp-1 font-medium after:absolute after:inset-0 hover:text-primary sm:text-lg"
        >
          {story.title}
        </Link>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {story.author.name}
          {story.genres[0] && <span className="text-rose-gold"> · {story.genres[0].name}</span>}
          <span className="hidden sm:inline">
            {' · '}
            {story.chapterCount} chương, {story.status === 'completed' ? 'hoàn thành' : 'đang ra'}
          </span>
        </p>
        <p className="mt-0.5 text-sm sm:hidden">
          <span className="font-medium">{metric.value}</span>{' '}
          <span className="text-muted-foreground">{metric.unit}</span>
        </p>
      </div>
      <p className="hidden text-right sm:block">
        <span className="block font-heading text-2xl leading-none font-semibold lining-nums">
          {metric.value}
        </span>
        <span className="text-xs text-muted-foreground">{metric.unit}</span>
      </p>
    </div>
  )
}
