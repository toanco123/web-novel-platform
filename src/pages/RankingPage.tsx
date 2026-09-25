import { Trophy } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { SectionError } from '@/components/common/SectionHeading'
import { SegmentedLinks } from '@/components/common/SegmentedLinks'
import { SITE_NAME } from '@/config/site'
import type { RankedStory, RankingCriterion, RankingPeriod } from '@/features/stories/api'
import { useRanking } from '@/features/stories/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

const criteria: { value: RankingCriterion; param: string; label: string; hint: string }[] = [
  {
    value: 'views',
    param: 'luot-doc',
    label: 'Đọc nhiều',
    hint: 'Xếp theo lượt đọc chương trong kỳ.',
  },
  {
    value: 'rating',
    param: 'danh-gia',
    label: 'Điểm cao',
    hint: 'Xếp theo điểm, có tính cả số lượt chấm để truyện ít lượt chấm không lên đầu.',
  },
  {
    value: 'follows',
    param: 'theo-doi',
    label: 'Theo dõi nhiều',
    hint: 'Xếp theo số người thêm truyện vào tủ.',
  },
]

const periods: { value: RankingPeriod; param: string; label: string }[] = [
  { value: 'week', param: 'tuan', label: 'Tuần' },
  { value: 'month', param: 'thang', label: 'Tháng' },
  { value: 'all', param: 'tat-ca', label: 'Mọi lúc' },
]

const rankColor = ['text-neon', 'text-rose-gold', 'text-rose-gold/80']

export default function RankingPage() {
  const [params] = useSearchParams()
  const criterion = criteria.find((c) => c.param === params.get('theo')) ?? criteria[0]
  const period = periods.find((p) => p.param === params.get('ky')) ?? periods[0]
  const { data, isPending, isError, isPlaceholderData } = useRanking(criterion.value, period.value)

  const search = (theo: string, ky?: string) => {
    const next = new URLSearchParams()
    if (theo !== criteria[0].param) next.set('theo', theo)
    if (ky && ky !== periods[0].param) next.set('ky', ky)
    const s = next.toString()
    return s ? `?${s}` : ''
  }

  return (
    <Container className="py-10">
      <title>{`Bảng xếp hạng truyện | ${SITE_NAME}`}</title>
      <meta
        name="description"
        content="Truyện đọc nhiều, đánh giá cao và được theo dõi nhiều nhất."
      />
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
        {criterion.value === 'views' && (
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
              ? Array.from({ length: 8 }, (_, i) => (
                  <li key={i} className="flex items-center gap-4 p-4">
                    <div className="size-8 animate-pulse rounded bg-muted" />
                    <div className="aspect-[2/3] w-12 animate-pulse rounded bg-muted" />
                    <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
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
      : { value: formatCount(value), unit: criterion === 'views' ? 'lượt đọc' : 'theo dõi' }

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
