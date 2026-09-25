import { Search } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGenres } from '@/features/genres/hooks'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** Gọi sau khi tìm kiếm hoặc chọn thể loại (vd đóng menu mobile) */
  onNavigate?: () => void
  /** Hiện bảng gợi ý thể loại khi focus vào ô tìm kiếm */
  showGenreHints?: boolean
}

export function SearchBox({ className, onNavigate, showGenreHints = true }: Props) {
  const navigate = useNavigate()
  const { data: genres } = useGenres()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    if (!q) return
    setOpen(false)
    navigate(paths.search(q))
    onNavigate?.()
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
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      className={cn('relative', className)}
    >
      <label htmlFor="site-search" className="sr-only">
        Tìm truyện
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id="site-search"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Tìm tên truyện, tác giả..."
        className="h-10 w-full rounded-full border border-input bg-muted/60 pr-4 pl-10 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      {showGenreHints && open && genres && (
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
