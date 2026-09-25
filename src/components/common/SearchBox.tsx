import { Search } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGenres } from '@/features/genres/hooks'
import { useSearchSuggestions } from '@/features/stories/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** Gọi sau khi tìm kiếm hoặc chọn thể loại (vd đóng menu mobile) */
  onNavigate?: () => void
  /** Hiện bảng gợi ý thể loại khi focus vào ô tìm kiếm còn trống */
  showGenreHints?: boolean
}

const MIN_QUERY = 2

/**
 * Ô tìm kiếm ở header (combobox): gõ từ 2 ký tự thì gợi ý truyện, ↑ ↓ để chọn, Enter để mở,
 * Esc để đóng. Ô trống thì gợi ý thể loại.
 */
export function SearchBox({ className, onNavigate, showGenreHints = true }: Props) {
  const navigate = useNavigate()
  const { data: genres } = useGenres()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLFormElement>(null)
  const id = useId()
  const listId = `${id}-suggestions`
  const optionId = (i: number) => `${id}-option-${i}`

  const query = value.trim()
  const debounced = useDebouncedValue(query, 200)
  const suggesting = query.length >= MIN_QUERY
  const suggestions = useSearchSuggestions(suggesting ? debounced : '')
  const stories = suggesting ? (suggestions.data ?? []) : []
  // Các lựa chọn: truyện gợi ý + dòng cuối "Xem tất cả kết quả"
  const options = [
    ...stories.map((s) => ({ key: s.slug, to: paths.story(s.slug) })),
    { key: 'all', to: paths.search(query) },
  ]
  const listOpen = open && suggesting

  function go(to: string) {
    setOpen(false)
    setActive(-1)
    navigate(to)
    onNavigate?.()
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!query) return
    go(listOpen && active >= 0 ? options[active].to : paths.search(query))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
      return
    }
    if (!suggesting || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    e.preventDefault()
    setOpen(true)
    // Vòng qua các lựa chọn; -1 là đang ở ô nhập (chưa chọn gì)
    const last = options.length - 1
    const down = e.key === 'ArrowDown'
    setActive((i) => (down ? (i >= last ? -1 : i + 1) : i <= -1 ? last : i - 1))
  }

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={handleSubmit}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      className={cn('relative', className)}
    >
      <label htmlFor={`${id}-input`} className="sr-only">
        Tìm truyện
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id={`${id}-input`}
        name="q"
        type="search"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Tìm tên truyện, tác giả..."
        className="h-10 w-full rounded-full border border-input bg-muted/60 pr-4 pl-10 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />

      {listOpen && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl shadow-black/20">
          <ul id={listId} role="listbox" aria-label="Gợi ý truyện" className="p-1.5">
            {stories.map((s, i) => (
              <li
                key={s.slug}
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(paths.story(s.slug))}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg p-2',
                  active === i && 'bg-muted',
                )}
              >
                <StoryCover story={s} compact className="w-8 shrink-0 rounded-sm" />
                <span className="min-w-0">
                  <span className="line-clamp-1 text-sm font-medium">{s.title}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {s.author.name}, {s.chapterCount} chương
                  </span>
                </span>
              </li>
            ))}
            {suggestions.data?.length === 0 && debounced === query && (
              <li role="presentation" className="px-3 py-2.5 text-sm text-muted-foreground">
                Chưa thấy truyện nào khớp ngay. Thử tìm trong toàn bộ.
              </li>
            )}
            <li
              id={optionId(stories.length)}
              role="option"
              aria-selected={active === stories.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(paths.search(query))}
              onMouseEnter={() => setActive(stories.length)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rose-gold',
                active === stories.length && 'bg-muted',
              )}
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="line-clamp-1">Xem tất cả kết quả cho “{query}”</span>
            </li>
          </ul>
        </div>
      )}

      {showGenreHints && open && !suggesting && genres && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl shadow-black/20">
          <p className="mb-2.5 text-xs text-muted-foreground">Tìm nhanh theo thể loại</p>
          <div className="flex flex-wrap gap-1.5">
            {genres.slice(0, 10).map((g) => (
              <Link
                key={g.slug}
                to={paths.genre(g.slug)}
                onClick={() => {
                  setOpen(false)
                  onNavigate?.()
                }}
                className="rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary/50 hover:text-primary focus-visible:border-ring focus-visible:outline-none"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
