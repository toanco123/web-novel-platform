import { Search } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { Pagination } from '@/components/common/Pagination'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useSearchStories } from '@/features/stories/hooks'
import { GenreCloud } from '@/features/stories/sections/GenreCloud'
import { TrendingWeekly } from '@/features/stories/sections/TrendingWeekly'
import { StoryRow, StoryRowSkeleton } from '@/features/stories/StoryRow'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const page = Math.max(1, Number(params.get('trang')) || 1)

  const submit = (value: string) => {
    const next = value.trim()
    setParams(next ? { q: next } : {})
  }

  return (
    <Container className="py-10">
      <title>{q ? `Tìm “${q}” | ${SITE_NAME}` : `Tìm kiếm | ${SITE_NAME}`}</title>
      <h1 className="font-heading text-4xl font-semibold">Tìm truyện</h1>
      {/* key: tìm từ ô ở header thì ô này cập nhật theo */}
      <SearchForm key={q} initial={q} onSubmit={submit} />

      {q ? (
        <Results q={q} page={page} />
      ) : (
        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <GenreCloud />
          <TrendingWeekly />
        </div>
      )}
    </Container>
  )
}

function SearchForm({ initial, onSubmit }: { initial: string; onSubmit: (q: string) => void }) {
  const [value, setValue] = useState(initial)
  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="mt-4 flex max-w-2xl gap-2">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="search-page-input" className="sr-only">
          Tên truyện hoặc tác giả
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="search-page-input"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          placeholder="Tên truyện hoặc tác giả, gõ không dấu cũng được"
          className="h-12 w-full rounded-full border border-input bg-muted/60 pr-4 pl-12 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </div>
      <Button type="submit" className="h-12 rounded-full px-6">
        Tìm
      </Button>
    </form>
  )
}

function Results({ q, page }: { q: string; page: number }) {
  const { data, isPending, isError, isPlaceholderData } = useSearchStories(q, page)

  if (isError) {
    return (
      <div className="mt-8">
        <SectionError />
      </div>
    )
  }

  return (
    <div className="mt-8">
      <p className="text-muted-foreground" aria-live="polite">
        {data ? (
          <>
            {data.total > 0 ? `${data.total} truyện` : 'Không tìm thấy truyện nào'} cho{' '}
            <span className="font-medium text-foreground">“{q}”</span>
          </>
        ) : (
          'Đang tìm…'
        )}
      </p>

      {data && data.genres.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Thể loại:</span>
          {data.genres.map((g) => (
            <Link
              key={g.slug}
              to={paths.genre(g.slug)}
              className="rounded-full border border-rose-gold/40 px-3.5 py-1.5 text-sm text-rose-gold transition-colors hover:border-rose-gold"
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {isPending ? (
        <div className="mt-4 divide-y">
          {Array.from({ length: 4 }, (_, i) => (
            <StoryRowSkeleton key={i} />
          ))}
        </div>
      ) : data.total === 0 ? (
        <div className="mt-6 space-y-12">
          <p className="max-w-prose rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Thử gõ ngắn hơn, bỏ bớt từ, hoặc tìm theo tên tác giả. Dưới đây là vài gợi ý cho bạn.
          </p>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <GenreCloud />
            <TrendingWeekly />
          </div>
        </div>
      ) : (
        <>
          <ul
            aria-label="Kết quả tìm kiếm"
            aria-busy={isPlaceholderData}
            className={cn('mt-4 divide-y', isPlaceholderData && 'opacity-60 transition-opacity')}
          >
            {data.items.map((s) => (
              <li key={s.slug}>
                <StoryRow story={s} />
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            pageCount={data.pageCount}
            searchFor={(p) => `?${new URLSearchParams({ q, ...(p > 1 && { trang: String(p) }) })}`}
            label="Phân trang kết quả tìm kiếm"
          />
        </>
      )}
    </div>
  )
}
