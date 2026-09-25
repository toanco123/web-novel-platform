import { useParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { SITE_NAME } from '@/config/site'
import { ChapterEditor } from '@/features/studio/components/ChapterEditor'
import { StudioBreadcrumb } from '@/features/studio/components/StudioBreadcrumb'
import { useMyChapter, useMyChapters, useMyStory } from '@/features/studio/hooks'
import { paths } from '@/lib/routes'

export default function ChapterEditorPage() {
  const { storyId = '', number } = useParams()
  const chapterNumber = number ? Number(number) : null
  const story = useMyStory(storyId)
  const chapters = useMyChapters(storyId)
  const chapter = useMyChapter(storyId, chapterNumber)

  if (story.isPending || chapters.isPending || (chapterNumber !== null && chapter.isPending)) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />
  }
  if (!story.data || (chapterNumber !== null && !chapter.data)) {
    return <NotFound message="Không tìm thấy chương này trong khu Sáng tác của bạn." />
  }

  const nextNumber = (chapters.data?.at(-1)?.number ?? 0) + 1
  const label = chapter.data ? `Chương ${chapter.data.number}` : 'Chương mới'

  return (
    <>
      <title>{`${label} | ${story.data.title} | ${SITE_NAME}`}</title>
      <StudioBreadcrumb
        items={[
          { label: 'Sáng tác', to: paths.studio },
          { label: story.data.title, to: paths.studioStory(storyId) },
          { label },
        ]}
      />
      <ChapterEditor
        key={chapter.data?.id ?? 'new'}
        story={story.data}
        chapter={chapter.data ?? null}
        nextNumber={nextNumber}
      />
    </>
  )
}
