import { PenLine } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { NotFound } from '@/components/common/NotFound'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useGenres } from '@/features/genres/hooks'
import { useStoriesByGenre } from '@/features/stories/hooks'
import { StoryCard, StoryCardSkeleton } from '@/features/stories/StoryCard'
import { paths } from '@/lib/routes'

export default function GenreStoriesPage() {
  const { slug = '' } = useParams()
  const genres = useGenres()
  const stories = useStoriesByGenre(slug)
  const genre = genres.data?.find((g) => g.slug === slug)

  if (genres.data && !genre) return <NotFound message="Không tìm thấy thể loại này." />

  return (
    <Container className="py-10">
      {genre && <title>{`Truyện ${genre.name} | ${SITE_NAME}`}</title>}
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to={paths.genres} className="hover:text-foreground hover:underline">
          Thể loại
        </Link>
      </nav>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold">{genre?.name ?? '…'}</h1>
          {genre?.description && (
            <p className="mt-2 max-w-prose text-muted-foreground">{genre.description}</p>
          )}
          {genre?.createdBy && (
            <p className="mt-1 text-xs text-rose-gold">
              Thể loại do {genre.createdBy.displayName} tạo
            </p>
          )}
        </div>
        {genre && (
          <Button asChild className="h-10 rounded-full px-5">
            <Link to={paths.studioNewStory(genre.slug)}>
              <PenLine />
              Đăng truyện {genre.name}
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-8">
        {stories.isError ? (
          <SectionError />
        ) : stories.data?.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground">Chưa có truyện nào thuộc thể loại này.</p>
            <Button asChild className="mt-4 h-10 rounded-full px-5">
              <Link to={paths.studioNewStory(slug)}>Đăng truyện đầu tiên</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {stories.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <li key={i}>
                    <StoryCardSkeleton />
                  </li>
                ))
              : stories.data.map((s) => (
                  <li key={s.slug}>
                    <StoryCard story={s} />
                  </li>
                ))}
          </ul>
        )}
      </div>
    </Container>
  )
}
