import { BookOpen, Clock, Eye, EyeOff, PenLine, Star } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '@/components/common/Container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/hooks'
import { FollowButton } from '@/features/library/components/FollowButton'
import { DownloadButton } from '@/features/offline/components/DownloadButton'
import { VoteButton } from '@/features/rewards/components/VoteButton'
import { useStoryProgress } from '@/features/library/hooks'
import { resumeState } from '@/features/library/resume'
import { formatCount, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Story } from '@/types/story'
import { coverPalette } from '../coverPalette'
import { StoryCover } from '../StoryCover'
import { UpcomingChapter } from '../UpcomingChapter'
import { Breadcrumb } from './Breadcrumb'

const onDarkOutline =
  'h-11 rounded-full border-[#f4e7ed]/30 bg-transparent px-5 text-[#f4e7ed] hover:border-[#f4e7ed]/60 hover:bg-white/10 hover:text-[#f4e7ed] dark:bg-transparent'

export function StoryHero({ story }: { story: Story }) {
  const p = coverPalette(story.slug)
  const genre = story.genres[0]
  const { data: viewer } = useSession()
  const isOwner = !!story.ownerId && story.ownerId === viewer?.id

  return (
    <section className="relative isolate overflow-hidden border-b text-[#f4e7ed]">
      {story.visibility === 'draft' && (
        <p className="flex items-center justify-center gap-2 bg-[#d9a68f] px-4 py-2 text-center text-sm font-medium text-[#1a0f1d]">
          <EyeOff className="size-4 shrink-0" aria-hidden />
          {/* Người khác thấy truyện chưa công khai chỉ có thể là quản trị viên xem truyện chờ duyệt */}
          {isOwner
            ? 'Truyện chưa công khai, chỉ bạn thấy trang này. Xuất bản hoặc gửi duyệt trong khu Sáng tác để mọi người đọc được.'
            : 'Truyện đang chờ duyệt, chỉ tác giả và ban quản trị thấy trang này.'}
        </p>
      )}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: `linear-gradient(115deg, ${p.to} 10%, ${p.from} 60%, ${p.to} 100%)` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50%_90%_at_15%_50%,rgb(255_61_139/0.18),transparent_70%)]"
      />

      <Container className="py-6 lg:py-10">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: paths.home },
            ...(genre ? [{ label: genre.name, to: paths.genre(genre.slug) }] : []),
            { label: story.title },
          ]}
        />

        <div className="mt-6 grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-5 gap-y-6 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-12">
          <div className="overflow-hidden rounded-lg shadow-[0_24px_60px_-20px_rgb(0_0_0/0.7)] ring-1 ring-white/10 lg:row-span-2">
            <StoryCover story={story} priority />
          </div>

          <div className="min-w-0 self-center lg:self-end">
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#d9a68f]">
              {story.genres.map((g) => (
                <Link key={g.slug} to={paths.genre(g.slug)} className="hover:underline">
                  {g.name}
                </Link>
              ))}
            </p>
            <h1 className="mt-2 font-heading text-3xl leading-[1.05] font-semibold text-balance sm:text-4xl lg:text-6xl">
              {story.title}
            </h1>
            <p className="mt-2 text-[#f4e7ed]/80 lg:mt-3">
              của{' '}
              <Link
                to={paths.search(story.author.name)}
                className="font-heading text-lg font-semibold text-[#f4e7ed] italic hover:underline lg:text-xl"
              >
                {story.author.name}
              </Link>
            </p>
          </div>

          <div className="col-span-2 space-y-6 lg:col-span-1 lg:col-start-2">
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#f4e7ed]/85">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Đánh giá</dt>
                <Star className="size-4 fill-[#d9a68f] text-[#d9a68f]" aria-hidden />
                <dd>
                  {story.ratingCount > 0 ? (
                    <>
                      {story.ratingAvg.toFixed(1)}{' '}
                      <span className="text-[#f4e7ed]/55">({formatCount(story.ratingCount)})</span>
                    </>
                  ) : (
                    'Chưa có đánh giá'
                  )}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Lượt xem</dt>
                <Eye className="size-4" aria-hidden />
                <dd>{formatCount(story.viewCount)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Số chương</dt>
                <BookOpen className="size-4" aria-hidden />
                <dd>
                  {story.chapterCount} chương,{' '}
                  {story.status === 'completed' ? 'đã hoàn thành' : 'đang ra'}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Cập nhật</dt>
                <Clock className="size-4" aria-hidden />
                <dd>
                  Cập nhật{' '}
                  <time dateTime={story.updatedAt}>{formatRelativeTime(story.updatedAt)}</time>
                </dd>
              </div>
            </dl>

            <UpcomingChapter next={story.nextChapter} className="-mt-3 text-[#d9a68f]" />

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ReadButtons story={story} />
              {isOwner ? (
                <Button asChild variant="outline" className={onDarkOutline}>
                  <Link to={paths.studioStory(story.id)}>
                    <PenLine />
                    Quản lý truyện
                  </Link>
                </Button>
              ) : (
                <FollowButton slug={story.slug} onDark />
              )}
              <VoteButton story={story} />
              <StoryDownloadButton story={story} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

const primaryButton =
  'h-11 rounded-full bg-[#ff3d8b] px-6 text-[#1a0f1d] shadow-[0_0_30px_rgb(255_61_139/0.4)] hover:bg-[#ff5c9e]'

/** Đã đọc dở: "Đọc tiếp" là nút chính; chưa đọc: đọc từ chương đầu và chương mới nhất */
function ReadButtons({ story }: { story: Story }) {
  const { data: progress, isPending } = useStoryProgress(story.slug)
  if (story.firstChapterNumber === null) return null
  // Chưa biết chỗ đọc dở (đang chờ phiên hoặc lịch sử): giữ chỗ, không hiện nút "Đọc từ chương" rồi đổi
  if (isPending) {
    const latest = story.latestChapter?.number
    return (
      <ReadButtonsSkeleton second={latest !== undefined && latest !== story.firstChapterNumber} />
    )
  }

  if (progress) {
    return (
      <>
        <Button asChild className={primaryButton}>
          <Link to={paths.chapter(story.slug, progress.chapter)} state={resumeState(progress)}>
            <BookOpen />
            Đọc tiếp chương {progress.chapter}
          </Link>
        </Button>
        {progress.chapter !== story.firstChapterNumber && (
          <Button asChild variant="outline" className={onDarkOutline}>
            <Link to={paths.chapter(story.slug, story.firstChapterNumber)}>Đọc từ đầu</Link>
          </Button>
        )}
      </>
    )
  }

  return (
    <>
      <Button asChild className={primaryButton}>
        <Link to={paths.chapter(story.slug, story.firstChapterNumber)}>
          <BookOpen />
          Đọc từ chương {story.firstChapterNumber}
        </Link>
      </Button>
      {story.latestChapter && story.latestChapter.number !== story.firstChapterNumber && (
        <Button asChild variant="outline" className={onDarkOutline}>
          <Link to={paths.chapter(story.slug, story.latestChapter.number)}>
            Chương mới nhất ({story.latestChapter.number})
          </Link>
        </Button>
      )}
    </>
  )
}

function ReadButtonsSkeleton({ second = true }: { second?: boolean }) {
  return (
    <>
      <OnDarkSkeleton className="h-11 rounded-full sm:w-44" />
      {second && <OnDarkSkeleton className="h-11 rounded-full sm:w-48" />}
    </>
  )
}

/** Khối chờ trên nền tối cố định của phần đầu trang */
function OnDarkSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('bg-white/10', className)} />
}

/** Khung chờ phần đầu trang: cùng nền màu theo truyện và cùng bố cục với StoryHero */
export function StoryHeroSkeleton({ slug }: { slug: string }) {
  const p = coverPalette(slug)
  return (
    <section aria-hidden className="relative isolate overflow-hidden border-b">
      <div
        className="absolute inset-0 -z-10"
        style={{ background: `linear-gradient(115deg, ${p.to} 10%, ${p.from} 60%, ${p.to} 100%)` }}
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50%_90%_at_15%_50%,rgb(255_61_139/0.18),transparent_70%)]" />

      <Container className="py-6 lg:py-10">
        <div className="flex h-5 items-center">
          <OnDarkSkeleton className="h-4 w-56" />
        </div>

        <div className="mt-6 grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-5 gap-y-6 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-12">
          <OnDarkSkeleton className="aspect-[2/3] rounded-lg lg:row-span-2" />

          <div className="min-w-0 self-center lg:self-end">
            <OnDarkSkeleton className="h-4 w-32" />
            <OnDarkSkeleton className="mt-3 h-8 w-4/5 sm:h-9 lg:h-14" />
            <OnDarkSkeleton className="mt-3 h-5 w-40 lg:mt-4" />
          </div>

          <div className="col-span-2 space-y-6 lg:col-span-1 lg:col-start-2">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {['w-20', 'w-14', 'w-36', 'w-32'].map((w) => (
                <OnDarkSkeleton key={w} className={cn('h-5', w)} />
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ReadButtonsSkeleton />
              <OnDarkSkeleton className="h-11 rounded-full sm:w-52" />
              <OnDarkSkeleton className="h-11 rounded-full sm:w-48" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

/** Tải từ chỗ đọc dở, chưa đọc thì từ chương đầu; truyện chưa công khai không lưu offline */
function StoryDownloadButton({ story }: { story: Story }) {
  const { data: progress } = useStoryProgress(story.slug)
  if (story.firstChapterNumber === null || story.visibility !== 'published') return null
  return (
    <DownloadButton
      slug={story.slug}
      title={story.title}
      from={progress?.chapter ?? story.firstChapterNumber}
      className={onDarkOutline}
    />
  )
}
