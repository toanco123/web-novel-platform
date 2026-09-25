import { useParams, useSearchParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { NotFound } from '@/components/common/NotFound'
import { SectionError, SectionHeading } from '@/components/common/SectionHeading'
import { SITE_NAME } from '@/config/site'
import { ChapterList } from '@/features/chapters/components/ChapterList'
import { CommentsSection } from '@/features/comments/components/CommentsSection'
import { useComments } from '@/features/comments/hooks'
import { useStoryProgress } from '@/features/library/hooks'
import { SectionNav } from '@/features/stories/detail/SectionNav'
import { SideStoryList } from '@/features/stories/detail/SideStoryList'
import { StoryDescription } from '@/features/stories/detail/StoryDescription'
import { StoryHero, StoryHeroSkeleton } from '@/features/stories/detail/StoryHero'
import { useRelatedStories, useStoriesByAuthor, useStory } from '@/features/stories/hooks'
import type { ChapterOrder } from '@/types/chapter'
import type { Story } from '@/types/story'

const SECTION = {
  about: 'gioi-thieu',
  chapters: 'danh-sach-chuong',
  comments: 'binh-luan',
} as const

// Chừa chỗ cho header + thanh mục lục khi nhảy tới section
const sectionClass = 'scroll-mt-36 lg:scroll-mt-48'

export default function StoryDetailPage() {
  const { slug = '' } = useParams()
  const { data: story, isPending, isError } = useStory(slug)

  if (isPending) return <StoryHeroSkeleton />
  if (isError)
    return (
      <Container className="py-16">
        <SectionError />
      </Container>
    )
  if (!story)
    return (
      <NotFound message="Không tìm thấy truyện này. Có thể truyện đã bị gỡ hoặc đổi đường dẫn." />
    )
  return <StoryDetail key={story.slug} story={story} />
}

function StoryDetail({ story }: { story: Story }) {
  const [params] = useSearchParams()
  const page = Math.max(1, Number(params.get('trang')) || 1)
  const order: ChapterOrder = params.get('sap-xep') === 'moi' ? 'desc' : 'asc'
  const comments = useComments(story.slug)
  const byAuthor = useStoriesByAuthor(story.author.slug, story.slug)
  const related = useRelatedStories(story.slug)
  const { data: progress } = useStoryProgress(story.slug)

  const searchFor = (p: number, o: ChapterOrder) => {
    const next = new URLSearchParams()
    if (p > 1) next.set('trang', String(p))
    if (o === 'desc') next.set('sap-xep', 'moi')
    const s = next.toString()
    return s ? `?${s}` : ''
  }
  const scrollToChapters = () =>
    document.getElementById(SECTION.chapters)?.scrollIntoView({ block: 'start' })

  return (
    <>
      <title>{`${story.title} - ${story.author.name} | ${SITE_NAME}`}</title>
      <meta name="description" content={story.description.slice(0, 155)} />

      <StoryHero story={story} />
      <SectionNav
        items={[
          { id: SECTION.about, label: 'Giới thiệu' },
          { id: SECTION.chapters, label: 'Danh sách chương', count: story.chapterCount },
          { id: SECTION.comments, label: 'Bình luận', count: comments.data?.pages[0]?.total },
        ]}
      />

      <Container className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-16">
          <section id={SECTION.about} aria-labelledby="about-title" className={sectionClass}>
            <SectionHeading id="about-title">Giới thiệu</SectionHeading>
            <StoryDescription story={story} />
          </section>

          <section id={SECTION.chapters} aria-labelledby="chapters-title" className={sectionClass}>
            <SectionHeading id="chapters-title">Danh sách chương</SectionHeading>
            <ChapterList
              story={story}
              page={page}
              order={order}
              searchFor={searchFor}
              onNavigate={scrollToChapters}
              readingChapter={progress?.chapter}
            />
          </section>

          <section id={SECTION.comments} aria-labelledby="comments-title" className={sectionClass}>
            <SectionHeading id="comments-title">Bình luận & đánh giá</SectionHeading>
            <CommentsSection slug={story.slug} />
          </section>
        </div>

        <aside className="grid content-start gap-10 md:grid-cols-2 lg:grid-cols-1">
          <SideStoryList
            id="same-author"
            title="Cùng tác giả"
            stories={byAuthor.data}
            isPending={byAuthor.isPending}
          />
          <SideStoryList
            id="related"
            title="Cùng thể loại"
            stories={related.data}
            isPending={related.isPending}
          />
        </aside>
      </Container>
    </>
  )
}
