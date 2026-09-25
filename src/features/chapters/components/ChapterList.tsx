import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { formatDate } from '@/lib/format'
import { pageList } from '@/lib/pagination'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ChapterOrder } from '@/types/chapter'
import type { Story } from '@/types/story'
import { useChapterList } from '../hooks'
import { JumpToChapter } from './JumpToChapter'

type Props = {
  story: Story
  page: number
  order: ChapterOrder
  /** Tạo query string cho trang/thứ tự (giữ trên URL để chia sẻ được) */
  searchFor: (page: number, order: ChapterOrder) => string
  onNavigate: () => void
}

export function ChapterList({ story, page, order, searchFor, onNavigate }: Props) {
  const { data, isPending, isError, isPlaceholderData } = useChapterList(story.slug, page, order)

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
            ? Array.from({ length: 12 }, (_, i) => (
                <li key={i} className="py-3">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                </li>
              ))
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

      {data && data.pageCount > 1 && (
        <ChapterPagination
          page={data.page}
          pageCount={data.pageCount}
          hrefFor={(p) => searchFor(p, order)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

function ChapterPagination({
  page,
  pageCount,
  hrefFor,
  onNavigate,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  onNavigate: () => void
}) {
  const item =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm tabular-nums'
  const link = (p: number, children: React.ReactNode, label?: string) => (
    <Link
      to={{ search: hrefFor(p) }}
      preventScrollReset
      onClick={onNavigate}
      aria-label={label}
      aria-current={p === page ? 'page' : undefined}
      className={cn(
        item,
        p === page
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )

  return (
    <nav aria-label="Phân trang danh sách chương" className="mt-6">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            link(page - 1, <ChevronLeft className="size-4" />, 'Trang trước')
          ) : (
            <span className={cn(item, 'opacity-40')} aria-hidden>
              <ChevronLeft className="size-4" />
            </span>
          )}
        </li>
        {pageList(page, pageCount).map((p, i) => (
          <li key={`${p}-${i}`}>
            {p === '…' ? (
              <span className={cn(item, 'text-muted-foreground')} aria-hidden>
                …
              </span>
            ) : (
              link(p, p, `Trang ${p}`)
            )}
          </li>
        ))}
        <li>
          {page < pageCount ? (
            link(page + 1, <ChevronRight className="size-4" />, 'Trang sau')
          ) : (
            <span className={cn(item, 'opacity-40')} aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
