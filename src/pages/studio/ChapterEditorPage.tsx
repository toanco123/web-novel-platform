import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { SITE_NAME } from '@/config/site'
import { ChapterEditor } from '@/features/studio/components/ChapterEditor'
import { StudioBreadcrumb } from '@/features/studio/components/StudioBreadcrumb'
import { useMyChapter, useMyChapters, useMyStory } from '@/features/studio/hooks'
import { CHAPTER_NUMBER_MAX } from '@/features/studio/schemas'
import { paths } from '@/lib/routes'
import type { Chapter } from '@/types/chapter'

export default function ChapterEditorPage() {
  const { storyId = '', number } = useParams()
  const [params] = useSearchParams()
  const chapterNumber = number ? Number(number) : null
  const story = useMyStory(storyId)
  const chapters = useMyChapters(storyId)
  const chapter = useMyChapter(storyId, chapterNumber)
  // Giữ chương đã mở: đổi số chương rồi lưu thì truy vấn theo số cũ trả về null trong lúc
  // chuyển về trang quản lý, không được hiện "không tìm thấy" hay dựng lại trình soạn
  const [opened, setOpened] = useState<Chapter | null>(null)
  if (chapter.data && chapter.data.id !== opened?.id) setOpened(chapter.data)
  const current = chapter.data ?? (opened?.number === chapterNumber ? opened : null)

  if (story.isPending || chapters.isPending || (chapterNumber !== null && chapter.isPending)) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />
  }
  if (!story.data || (chapterNumber !== null && !current)) {
    return <NotFound message="Không tìm thấy chương này trong khu Sáng tác của bạn." />
  }

  const all = chapters.data ?? []
  // ?so=2 (từ dòng "chưa viết" trong danh sách chương): điền sẵn nếu hợp lệ và còn trống
  const preset = Number(params.get('so'))
  const defaultNumber =
    Number.isInteger(preset) &&
    preset >= 1 &&
    preset <= CHAPTER_NUMBER_MAX &&
    !all.some((c) => c.number === preset)
      ? preset
      : (all.at(-1)?.number ?? 0) + 1
  const label = current ? `Chương ${current.number}` : 'Chương mới'

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
        key={current?.id ?? 'new'}
        story={story.data}
        chapter={current}
        chapters={all}
        defaultNumber={defaultNumber}
      />
    </>
  )
}
