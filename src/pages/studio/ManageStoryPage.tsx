import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SITE_NAME } from '@/config/site'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { useSession } from '@/features/auth/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import type { MyStory } from '@/features/studio/api'
import { ChapterTable } from '@/features/studio/components/ChapterTable'
import { DeleteStoryDialog } from '@/features/studio/components/DeleteStoryDialog'
import { StatusBadge } from '@/features/studio/components/StatusBadge'
import { StoryForm } from '@/features/studio/components/StoryForm'
import { StoryReportsPanel } from '@/features/studio/components/StoryReportsPanel'
import { StoryStatsPanel } from '@/features/studio/components/StoryStatsPanel'
import { StudioBreadcrumb } from '@/features/studio/components/StudioBreadcrumb'
import { studioErrorMessage } from '@/features/studio/errors'
import {
  useMyStory,
  useSetStoryVisibility,
  useSubmitStoryForReview,
  useUpdateStory,
} from '@/features/studio/hooks'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

export default function ManageStoryPage() {
  const { storyId = '' } = useParams()
  const { data: story, isPending } = useMyStory(storyId)

  if (isPending) return <div className="h-64 animate-pulse rounded-xl bg-muted" />
  if (!story) return <NotFound message="Không tìm thấy truyện này trong khu Sáng tác của bạn." />
  return <ManageStory story={story} />
}

const TABS = ['chapters', 'stats', 'reports', 'info']

function ManageStory({ story }: { story: MyStory }) {
  // Tab nằm trên URL (?tab=) để link từ danh sách Sáng tác mở đúng tab
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') ?? ''
  const tab = TABS.includes(tabParam) ? tabParam : 'chapters'
  const [deleteOpen, setDeleteOpen] = useState(false)
  const navigate = useNavigate()
  const published = story.visibility === 'published'

  return (
    <>
      <title>{`${story.title} | Sáng tác | ${SITE_NAME}`}</title>
      <StudioBreadcrumb items={[{ label: 'Sáng tác', to: paths.studio }, { label: story.title }]} />

      <header className="grid grid-cols-[5rem_minmax(0,1fr)] gap-5 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <div className="self-start overflow-hidden rounded-lg ring-1 ring-border">
          <StoryCover
            story={{
              ...story,
              author: { slug: '', name: story.authorName ?? story.owner.displayName },
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl leading-tight font-semibold sm:text-4xl">
              {story.title}
            </h1>
            <StatusBadge
              published={published}
              takenDown={!!story.takedown}
              review={story.review?.status}
            />
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

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setParams(value === 'chapters' ? {} : { tab: value }, {
            replace: true,
            preventScrollReset: true,
          })
        }
        className="mt-10"
      >
        {/* Màn hẹp: 4 tab cuộn ngang được */}
        <div className="relative -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList>
            <TabsTrigger value="chapters" className="px-4">
              Chương ({story.chapterCount})
            </TabsTrigger>
            <TabsTrigger value="stats" className="px-4">
              Thống kê
            </TabsTrigger>
            <TabsTrigger value="reports" className="px-4">
              Báo lỗi
              {story.openReports > 0 && (
                <span className="rounded-full bg-neon px-1.5 text-[0.7rem] leading-4 font-semibold text-background">
                  {story.openReports}
                  <span className="sr-only"> chưa xử lý</span>
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="info" className="px-4">
              Thông tin truyện
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="chapters" className="mt-6">
          <ChapterTable storyId={story.id} />
        </TabsContent>
        <TabsContent value="stats" className="mt-6">
          <StoryStatsPanel storyId={story.id} published={published} />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <StoryReportsPanel storyId={story.id} />
        </TabsContent>
        <TabsContent value="info" className="mt-6">
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
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          Xóa truyện
        </Button>
        <DeleteStoryDialog
          storyId={story.id}
          title={story.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => navigate(paths.studio, { replace: true })}
        />
      </section>
    </>
  )
}

function PublishControls({ story }: { story: MyStory }) {
  const { data: viewer } = useSession()
  const visibility = useSetStoryVisibility(story.id)
  const submit = useSubmitStoryForReview(story.id)
  const published = story.visibility === 'published'
  const review = story.review?.status ?? null
  // Quản trị viên miễn duyệt; truyện đã duyệt thì tác giả tự xuất bản / ẩn
  const approved = !!viewer?.isAdmin || review === 'approved'
  const hasChapter = story.publishedCount > 0
  const canPublish = hasChapter && !story.takedown
  // Gợi ý "cần xuất bản chương" (truyện bị gỡ thì đã có thông báo riêng ở trên)
  const needsChapter = !story.takedown && !hasChapter
  const error = visibility.error ?? submit.error

  return (
    <div className="space-y-3">
      {story.takedown && (
        <FormAlert>
          <strong>Truyện đã bị ban quản trị gỡ:</strong> {story.takedown.reason}
          <br />
          Người đọc không còn thấy truyện và bạn chưa xuất bản lại được. Nếu cho rằng đây là nhầm
          lẫn, hãy gửi tin nhắn ở trang <Link to={paths.contact}>Liên hệ</Link>.
        </FormAlert>
      )}
      {!published && review === 'rejected' && (
        <FormAlert>
          <strong>Truyện chưa được duyệt:</strong> {story.review?.reason}
          <br />
          Sửa theo góp ý rồi bấm "Gửi duyệt lại".
        </FormAlert>
      )}
      {!published && review === 'pending' && (
        <p role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          Truyện đang chờ ban quản trị duyệt
          {story.review?.submittedAt && ` (gửi ${formatRelativeTime(story.review.submittedAt)})`}.
          Bạn vẫn sửa truyện và viết thêm chương được; duyệt xong truyện tự công khai.
        </p>
      )}
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
        ) : approved ? (
          <Button
            className="h-10 rounded-full px-5"
            disabled={!canPublish || visibility.isPending}
            aria-describedby={needsChapter ? 'publish-hint' : undefined}
            onClick={() => visibility.mutate(true)}
          >
            Xuất bản truyện
          </Button>
        ) : (
          review !== 'pending' && (
            <Button
              className="h-10 rounded-full px-5"
              disabled={!canPublish || submit.isPending}
              aria-describedby={needsChapter ? 'publish-hint' : 'review-hint'}
              onClick={() => submit.mutate()}
            >
              {review === 'rejected' ? 'Gửi duyệt lại' : 'Gửi duyệt'}
            </Button>
          )
        )}
        <Button asChild variant="ghost" className="h-10 rounded-full px-4">
          <Link to={paths.story(story.slug)}>
            <ExternalLink />
            {published ? 'Xem trang truyện' : 'Xem trước'}
          </Link>
        </Button>
      </div>
      {!published && needsChapter && review !== 'pending' && (
        <p id="publish-hint" className="text-sm text-muted-foreground">
          Xuất bản ít nhất 1 chương để có thể {approved ? 'xuất bản truyện' : 'gửi duyệt'}.
        </p>
      )}
      {!published && !approved && review === null && !story.takedown && (
        <p id="review-hint" className="text-sm text-muted-foreground">
          Truyện mới cần ban quản trị duyệt trước khi công khai. Trong lúc chờ, bạn vẫn sửa truyện
          và viết thêm chương được.
        </p>
      )}
      {error && <FormAlert>{studioErrorMessage(error)}</FormAlert>}
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
        authorName: story.authorName ?? '',
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
