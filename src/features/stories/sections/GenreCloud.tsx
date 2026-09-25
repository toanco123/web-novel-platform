import { Link } from 'react-router'
import { SectionHeading } from '@/components/common/SectionHeading'
import { paths } from '@/lib/routes'
import { useGenres } from '@/features/genres/hooks'

export function GenreCloud() {
  const { data } = useGenres()
  if (!data) return null

  return (
    <section aria-labelledby="genre-cloud">
      <SectionHeading id="genre-cloud">Thể loại</SectionHeading>
      <div className="flex flex-wrap gap-2">
        {data.map((g) => (
          <Link
            key={g.slug}
            to={paths.genre(g.slug)}
            className="rounded-full border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            {g.name}
          </Link>
        ))}
      </div>
    </section>
  )
}
