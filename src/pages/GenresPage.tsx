import { PenLine, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Container } from '@/components/common/Container'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useSession } from '@/features/auth/hooks'
import { CreateGenreDialog } from '@/features/genres/components/CreateGenreDialog'
import { useGenres } from '@/features/genres/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { slugify } from '@/lib/slugify'

export default function GenresPage() {
  const { data: genres, isPending, isError } = useGenres()
  const [query, setQuery] = useState('')
  const q = slugify(query)
  const shown = genres?.filter(
    (g) => g.slug.includes(q) || slugify(g.description ?? '').includes(q),
  )

  return (
    <Container className="py-10">
      <title>{`Thể loại truyện | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold">Thể loại</h1>
          <p className="mt-1 text-muted-foreground">
            {genres ? `${genres.length} thể loại. ` : ''}Chưa thấy thể loại bạn cần? Tạo mới ngay.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10 rounded-full px-5">
            <Link to={paths.studioNewStory()}>
              <PenLine />
              Đăng truyện
            </Link>
          </Button>
          <CreateGenreButton />
        </div>
      </div>

      <div className="relative mt-6 max-w-sm">
        <label htmlFor="genre-filter" className="sr-only">
          Tìm thể loại
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="genre-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm thể loại…"
          className="h-10 w-full rounded-full border border-input bg-muted/60 pr-4 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </div>

      {isError ? (
        <div className="mt-8">
          <SectionError />
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isPending
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
              ))
            : shown!.map((g) => (
                <li key={g.slug}>
                  <Link
                    to={paths.genre(g.slug)}
                    className="group flex h-full flex-col rounded-xl border bg-card/50 p-4 transition-colors hover:border-primary/50"
                  >
                    <span className="font-heading text-xl leading-tight font-semibold group-hover:text-primary">
                      {g.name}
                    </span>
                    <span className="mt-0.5 text-sm text-muted-foreground">
                      {g.storyCount} truyện
                    </span>
                    {g.description && (
                      <span className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {g.description}
                      </span>
                    )}
                    {g.createdBy && (
                      <span className="mt-auto pt-2 text-xs text-rose-gold">
                        do {g.createdBy.displayName} tạo
                      </span>
                    )}
                  </Link>
                </li>
              ))}
        </ul>
      )}

      {shown?.length === 0 && (
        <div className="mt-2 rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Không tìm thấy thể loại “{query}”.</p>
          <div className="mt-3 flex justify-center">
            <CreateGenreButton
              defaultName={query.trim()}
              label={`Tạo thể loại “${query.trim()}”`}
            />
          </div>
        </div>
      )}
    </Container>
  )
}

function CreateGenreButton({
  defaultName,
  label = 'Tạo thể loại',
}: {
  defaultName?: string
  label?: string
}) {
  const { data: user, isPending } = useSession()
  const navigate = useNavigate()
  const current = useCurrentPath()
  const button = (
    <Button className="h-10 rounded-full px-5">
      <Plus />
      {label}
    </Button>
  )

  if (!user) {
    // Khóa nút khi phiên còn đang tải, tránh chuyển nhầm sang trang đăng nhập
    return (
      <Button
        className="h-10 rounded-full px-5"
        disabled={isPending}
        onClick={() => navigate(paths.login(current))}
      >
        <Plus />
        {label}
      </Button>
    )
  }
  return (
    <CreateGenreDialog
      trigger={button}
      defaultName={defaultName}
      onCreated={(g) => navigate(paths.genre(g.slug))}
    />
  )
}
