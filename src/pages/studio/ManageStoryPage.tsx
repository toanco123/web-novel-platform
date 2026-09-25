import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SITE_NAME } from '@/config/site'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { StoryCover } from '@/features/stories/StoryCover'
import type { MyStory } from '@/features/studio/api'
import { ChapterTable } from '@/features/studio/components/ChapterTable'
import { DeleteStoryDialog } from '@/features/studio/components/DeleteStoryDialog'
import { StatusBadge } from '@/features/studio/components/StatusBadge'
import { StoryForm } from '@/features/studio/components/StoryForm'
import { StudioBreadcrumb } from '@/features/studio/components/StudioBreadcrumb'
import { studioErrorMessage } from '@/features/studio/errors'
import { useMyStory, useSetStoryVisibility, useUpdateStory } from '@/features/studio/hooks'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

export default function ManageStoryPage() {
  const { storyId = '' } = useParams()
  const { data: story, isPending } = useMyStory(storyId)

  if (isPending) return <div className="h-64 animate-pulse rounded-xl bg-muted" />
  if (!story) return <NotFound message="Không tìm thấy truyện này trong khu Sáng tác của bạn." />
  return <ManageStory story={story} />
}

function ManageStory({ story }: { story: MyStory }) {
  const [tab, setTab] = useState('chuong')
  const published = story.visibility === 'published'

  return (
    <>
      <title>{`${story.title} | Sáng tác | ${SITE_NAME}`}</title>
      <StudioBreadcrumb items={[{ label: 'Sáng tác', to: paths.studio }, { label: story.title }]} />

      <header className="grid grid-cols-[5rem_minmax(0,1fr)] gap-5 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <div className="self-start overflow-hidden rounded-lg ring-1 ring-border">
          <StoryCover story={{ ...story, author: { slug: '', name: story.owner.displayName } }} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl leading-tight font-semibold sm:text-4xl">
              {story.title}
            </h1>
            <StatusBadge published={published} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {story.chapterCount} chương ({story.publishedCount} đã xuất bản, {story.draftCount}{' '}
            nháp), sửa {formatRelativeTime(story.updatedAt)}
          </p>
          <div className="mt-4">
            <PublishControls story={story} />
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="mt-10">
        <TabsList>
          <TabsTrigger value="chuong" className="px-4">
            Chương ({story.chapterCount})
          </TabsTrigger>
          <TabsTrigger value="thong-tin" className="px-4">
            Thông tin truyện
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chuong" className="mt-6">
          <ChapterTable storyId={story.id} />
        </TabsContent>
        <TabsContent value="thong-tin" className="mt-6">
          <EditStoryInfo story={story} />
        </TabsContent>
      </Tabs>

      <section
        aria-labelledby="danger-zone"
        className="mt-16 rounded-xl border border-destructive/30 p-5"
      >
        <h2 id="danger-zone" className="font-medium">
          Xóa truyện
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Xóa vĩnh viễn truyện và toàn bộ chương. Không khôi phục được.
        </p>
        <DeleteStoryDialog storyId={story.id} title={story.title} />
      </section>
    </>
  )
}

function PublishControls({ story }: { story: MyStory }) {
  const visibility = useSetStoryVisibility(story.id)
  const published = story.visibility === 'published'
  const canPublish = story.publishedCount > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {published ? (
          <Button
            variant="outline"
            className="h-10 rounded-full px-5"
            disabled={visibility.isPending}
            onClick={() => visibility.mutate(false)}
          >
            Ẩn truyện
          </Button>
        ) : (
          <Button
            className="h-10 rounded-full px-5"
            disabled={!canPublish || visibility.isPending}
            aria-describedby={canPublish ? undefined : 'publish-hint'}
            onClick={() => visibility.mutate(true)}
          >
            Xuất bản truyện
          </Button>
        )}
        <Button asChild variant="ghost" className="h-10 rounded-full px-4">
          <Link to={paths.story(story.slug)}>
            <ExternalLink />
            {published ? 'Xem trang truyện' : 'Xem trước'}
          </Link>
        </Button>
      </div>
      {!published && !canPublish && (
        <p id="publish-hint" className="text-sm text-muted-foreground">
          Xuất bản ít nhất 1 chương để có thể xuất bản truyện.
        </p>
      )}
      {visibility.isError && <FormAlert>{studioErrorMessage(visibility.error)}</FormAlert>}
      {visibility.isSuccess && (
        <FormAlert variant="success">
          {published
            ? 'Truyện đã công khai. Mọi người có thể tìm và đọc truyện của bạn.'
            : 'Đã ẩn truyện. Chỉ bạn thấy truyện này.'}
        </FormAlert>
      )}
    </div>
  )
}

function EditStoryInfo({ story }: { story: MyStory }) {
  const update = useUpdateStory(story.id)
  return (
    <StoryForm
      slug={story.slug}
      authorName={story.owner.displayName}
      defaultValues={{
        title: story.title,
        description: story.description,
        genreSlugs: story.genreSlugs,
        status: story.status,
        coverUrl: story.coverUrl,
      }}
      submitLabel="Lưu thay đổi"
      pendingLabel="Đang lưu…"
      pending={update.isPending}
      error={update.error}
      success={update.isSuccess ? 'Đã lưu thay đổi.' : null}
      onSubmit={(values) => update.mutate(values)}
    />
  )
}
