import { Link } from 'react-router'
import { Pagination } from '@/components/common/Pagination'
import { SectionError } from '@/components/common/SectionHeading'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ChapterOrder } from '@/types/chapter'
import type { Story } from '@/types/story'
import { useChapterList } from '../hooks'
import { CHAPTERS_PER_PAGE } from '../shared'
import { JumpToChapter } from './JumpToChapter'

type Props = {
  story: Story
  page: number
  order: ChapterOrder
  /** Tạo query string cho trang/thứ tự (giữ trên URL để chia sẻ được) */
  searchFor: (page: number, order: ChapterOrder) => string
  onNavigate: () => void
  /** Chương người xem đang đọc dở (gắn nhãn "Đang đọc") */
  readingChapter?: number
}

export function ChapterList({ story, page, order, searchFor, onNavigate, readingChapter }: Props) {
  const { data, isPending, isError, isPlaceholderData } = useChapterList(story.slug, page, order)
  // Lúc tải lần đầu: đúng số dòng của trang này (trang cuối có thể ít hơn) để khung không nhảy
  const onPage = story.chapterCount - (page - 1) * CHAPTERS_PER_PAGE
  const skeletonRows = Math.min(CHAPTERS_PER_PAGE, onPage > 0 ? onPage : story.chapterCount)

  if (story.chapterCount === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Truyện chưa có chương nào được xuất bản.
      </p>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Thứ tự chương"
          className="inline-flex rounded-full border p-0.5"
        >
          {(
            [
              ['asc', 'Cũ nhất'],
              ['desc', 'Mới nhất'],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              to={{ search: searchFor(1, value) }}
              preventScrollReset
              replace
              aria-current={order === value ? 'true' : undefined}
              className={cn(
                'inline-flex h-8 items-center rounded-full px-3.5 text-sm transition-colors',
                order === value
                  ? 'bg-secondary font-medium text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <JumpToChapter slug={story.slug} max={story.latestChapter?.number ?? story.chapterCount} />
      </div>

      {isError ? (
        <SectionError />
      ) : (
        <ol
          className={cn(
            'grid gap-x-6 divide-y md:grid-cols-2 md:divide-y-0',
            isPlaceholderData && 'opacity-60 transition-opacity',
          )}
          aria-busy={isPending || isPlaceholderData}
        >
          {isPending
            ? Array.from({ length: skeletonRows }, (_, i) => <ChapterRowSkeleton key={i} />)
            : data.items.map((c) => (
                <li key={c.number} className="md:border-b md:border-border/60">
                  <Link
                    to={paths.chapter(story.slug, c.number)}
                    className="group flex items-baseline gap-3 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate group-hover:text-primary">
                      <span className="font-medium">
                        Chương {c.number}
                        {c.title && ':'}
                      </span>{' '}
                      {c.title}
                    </span>
                    {c.number === readingChapter && (
                      <span className="rounded-sm bg-rose-gold/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-rose-gold">
                        Đang đọc
                      </span>
                    )}
                    {c.number === story.latestChapter?.number && (
                      <span className="rounded-sm bg-neon/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-neon">
                        Mới
                      </span>
                    )}
                    <time dateTime={c.createdAt} className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </time>
                  </Link>
                </li>
              ))}
        </ol>
      )}

      {isPending && !isError && story.chapterCount > CHAPTERS_PER_PAGE && <PaginationSkeleton />}
      {data && (
        <Pagination
          page={data.page}
          pageCount={data.pageCount}
          searchFor={(p) => searchFor(p, order)}
          label="Phân trang danh sách chương"
          preventScrollReset
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

/** Một dòng chờ cùng cỡ dòng chương (chữ text-sm, py-3) */
export function ChapterRowSkeleton() {
  return (
    <li className="py-3 md:border-b md:border-border/60">
      <div className="flex h-5 items-center gap-3">
        <Skeleton className="h-4 max-w-4/5 flex-1" />
        <Skeleton className="h-3 w-16 shrink-0" />
      </div>
    </li>
  )
}

/** Giữ chỗ cho thanh phân trang (h-9, mt-6) trong lúc chưa biết số trang */
export function PaginationSkeleton() {
  return (
    <div className="mt-6 flex justify-center gap-1" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className="size-9 rounded-full" />
      ))}
    </div>
  )
}
