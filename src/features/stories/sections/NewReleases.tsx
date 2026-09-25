import { SectionError, SectionHeading } from '@/components/common/SectionHeading'
import { useNewReleases } from '../hooks'
import { StoryCard, StoryCardSkeleton } from '../StoryCard'

export function NewReleases() {
  const { data, isPending, isError } = useNewReleases()

  return (
    <section aria-labelledby="new-releases">
      <SectionHeading id="new-releases">Truyện mới ra</SectionHeading>
      {isError ? (
        <SectionError />
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4 md:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
          {isPending
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <StoryCardSkeleton />
                </li>
              ))
            : data.map((s) => (
                <li key={s.slug}>
                  <StoryCard story={s} />
                </li>
              ))}
        </ul>
      )}
    </section>
  )
}
