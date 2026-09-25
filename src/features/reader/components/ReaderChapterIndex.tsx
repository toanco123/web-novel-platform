import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CHAPTERS_PER_PAGE } from '@/features/chapters/api'
import { JumpToChapter } from '@/features/chapters/components/JumpToChapter'
import { useChapterList } from '@/features/chapters/hooks'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
  current: number
  /** Số chương lớn nhất (để kiểm tra ô "đi tới chương") */
  max: number
  onNavigate: () => void
}

/** Mục lục trong trang đọc: mở sẵn trang chứa chương đang đọc và cuộn tới chương đó */
export function ReaderChapterIndex({ slug, current, max, onNavigate }: Props) {
  const [page, setPage] = useState(() => Math.max(1, Math.ceil(current / CHAPTERS_PER_PAGE)))
  const { data, isPending, isError, isPlaceholderData } = useChapterList(slug, page, 'asc')
  const currentRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [data])

  const pageCount = data?.pageCount ?? 1

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 pb-4">
        {pageCount > 1 && (
          <Select value={String(page)} onValueChange={(v) => setPage(Number(v))}>
            <SelectTrigger aria-label="Chọn khoảng chương" className="h-9 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: pageCount }, (_, i) => {
                const from = i * CHAPTERS_PER_PAGE + 1
                const to = Math.min((i + 1) * CHAPTERS_PER_PAGE, data?.total ?? max)
                return (
                  <SelectItem key={i} value={String(i + 1)}>
                    Chương {from}–{to}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}
        <JumpToChapter slug={slug} max={max} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isError ? (
          <div className="p-2">
            <SectionError />
          </div>
        ) : (
          <ol
            aria-busy={isPending || isPlaceholderData}
            className={cn(isPlaceholderData && 'opacity-60 transition-opacity')}
          >
            {isPending
              ? Array.from({ length: 14 }, (_, i) => (
                  <li key={i} className="px-3 py-2.5">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  </li>
                ))
              : data.items.map((c) => {
                  const active = c.number === current
                  return (
                    <li key={c.number}>
                      <Link
                        ref={active ? currentRef : undefined}
                        to={paths.chapter(slug, c.number)}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                          active
                            ? 'bg-primary/10 font-medium text-foreground ring-1 ring-primary/30'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <span className="w-10 shrink-0 text-right tabular-nums opacity-70">
                          {c.number}
                        </span>
                        <span className="min-w-0 truncate">{c.title}</span>
                      </Link>
                    </li>
                  )
                })}
          </ol>
        )}
      </div>
    </div>
  )
}
