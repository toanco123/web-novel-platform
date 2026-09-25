import { LoaderCircle, Plus, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { slugify } from '@/lib/slugify'
import { cn } from '@/lib/utils'
import { GenreExistsError } from '../api'
import { useCreateGenre, useGenres } from '../hooks'
import { genreSchema } from '../schemas'

type Props = {
  id: string
  value: string[]
  onChange: (slugs: string[]) => void
  onBlur?: () => void
  max?: number
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

type Option = { kind: 'genre'; slug: string; name: string } | { kind: 'create'; name: string }

/** Chọn nhiều thể loại (combobox). Gõ tên chưa có thì tạo thể loại mới ngay tại chỗ. */
export function GenrePicker({ id, value, onChange, onBlur, max = 5, ...aria }: Props) {
  const listId = useId()
  const { data: genres = [] } = useGenres()
  const create = useCreateGenre()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const q = slugify(query)
  const full = value.length >= max
  const selected = value.map((slug) => genres.find((g) => g.slug === slug) ?? { slug, name: slug })
  const exact = genres.find((g) => g.slug === q)
  const canCreate =
    q.length > 0 && !exact && genreSchema.shape.name.safeParse(query).success && !create.isPending
  const options: Option[] = [
    ...genres
      .filter((g) => !value.includes(g.slug) && (!q || g.slug.includes(q)))
      .slice(0, 8)
      .map((g) => ({ kind: 'genre' as const, slug: g.slug, name: g.name })),
    ...(canCreate ? [{ kind: 'create' as const, name: query.trim().replace(/\s+/g, ' ') }] : []),
  ]
  const expanded = open && !full && options.length > 0

  const add = (slug: string) => {
    if (!value.includes(slug) && value.length < max) onChange([...value, slug])
    setQuery('')
    setActive(0)
    // Đóng danh sách để không che phần form bên dưới; gõ tiếp hoặc bấm mũi tên thì mở lại
    setOpen(false)
  }

  function choose(option: Option) {
    if (option.kind === 'genre') return add(option.slug)
    create.mutate(
      { name: option.name, description: '' },
      {
        onSuccess: (genre) => add(genre.slug),
        // Vừa có người tạo trùng: chọn luôn thể loại đã có
        onError: (error) => error instanceof GenreExistsError && add(error.genre.slug),
      },
    )
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (options.length ? (i + delta + options.length) % options.length : 0))
    } else if (e.key === 'Enter') {
      // Không để Enter gửi cả form truyện
      e.preventDefault()
      if (expanded && options[active]) choose(options[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && !query && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Thể loại đã chọn">
          {selected.map((g) => (
            <li
              key={g.slug}
              className="inline-flex items-center gap-1 rounded-full bg-primary/12 py-1 pr-1 pl-3 text-sm text-primary ring-1 ring-primary/30"
            >
              {g.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== g.slug))}
                aria-label={`Bỏ thể loại ${g.name}`}
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
          aria-invalid={aria['aria-invalid']}
          aria-describedby={aria['aria-describedby']}
          autoComplete="off"
          value={query}
          disabled={full}
          placeholder={full ? `Đã chọn đủ ${max} thể loại` : 'Gõ để tìm hoặc tạo thể loại…'}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            onBlur?.()
          }}
          onKeyDown={handleKeyDown}
          className="h-11 w-full rounded-lg border border-input bg-transparent px-3.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 aria-invalid:border-destructive dark:bg-input/30"
        />
        {create.isPending && (
          <LoaderCircle
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Đang tạo thể loại"
          />
        )}
        {expanded && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Gợi ý thể loại"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl shadow-black/20"
          >
            {options.map((o, i) => (
              <li
                key={o.kind === 'genre' ? o.slug : 'create'}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Giữ focus ở ô nhập khi bấm chọn
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
                  i === active && 'bg-muted',
                  o.kind === 'create' && 'text-rose-gold',
                )}
              >
                {o.kind === 'create' ? (
                  <>
                    <Plus className="size-4" aria-hidden />
                    Tạo thể loại “{o.name}”
                  </>
                ) : (
                  o.name
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
