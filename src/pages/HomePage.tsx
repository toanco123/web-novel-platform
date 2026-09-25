import { Container } from '@/components/common/Container'
import { SITE_NAME, SITE_TAGLINE } from '@/config/site'
import { ContinueReading } from '@/features/library/components/ContinueReading'
import { EditorPicks } from '@/features/stories/sections/EditorPicks'
import { GenreCloud } from '@/features/stories/sections/GenreCloud'
import { HeroShowcase } from '@/features/stories/sections/HeroShowcase'
import { LatestUpdates } from '@/features/stories/sections/LatestUpdates'
import { NewReleases } from '@/features/stories/sections/NewReleases'
import { TrendingWeekly } from '@/features/stories/sections/TrendingWeekly'

export default function HomePage() {
  return (
    <>
      <title>{`${SITE_NAME}: đọc truyện chữ online`}</title>
      <meta name="description" content={SITE_TAGLINE} />
      <h1 className="sr-only">{SITE_NAME}</h1>

      <HeroShowcase />
      <ContinueReading />
      <EditorPicks />

      <Container className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-16">
          <LatestUpdates />
          <NewReleases />
        </div>
        <aside className="space-y-12">
          <TrendingWeekly />
          <GenreCloud />
        </aside>
      </Container>
    </>
  )
}
