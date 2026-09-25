import { BookOpen, Clock, Eye, EyeOff, PenLine, Star } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '@/components/common/Container'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks'
import { FollowButton } from '@/features/library/components/FollowButton'
import { formatCount, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import type { Story } from '@/types/story'
import { coverPalette } from '../coverPalette'
import { StoryCover } from '../StoryCover'
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
          Bản nháp, chỉ bạn thấy trang này. Xuất bản trong khu Sáng tác để mọi người đọc được.
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
            <StoryCover story={story} />
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

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {story.firstChapterNumber !== null && (
                <Button
                  asChild
                  className="h-11 rounded-full bg-[#ff3d8b] px-6 text-[#1a0f1d] shadow-[0_0_30px_rgb(255_61_139/0.4)] hover:bg-[#ff5c9e]"
                >
                  <Link to={paths.chapter(story.slug, story.firstChapterNumber)}>
                    <BookOpen />
                    Đọc từ chương {story.firstChapterNumber}
                  </Link>
                </Button>
              )}
              {story.latestChapter && story.latestChapter.number !== story.firstChapterNumber && (
                <Button asChild variant="outline" className={onDarkOutline}>
                  <Link to={paths.chapter(story.slug, story.latestChapter.number)}>
                    Chương mới nhất ({story.latestChapter.number})
                  </Link>
                </Button>
              )}
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
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

export function StoryHeroSkeleton() {
  return (
    <div className="border-b bg-muted/40">
      <Container className="py-6 lg:py-10">
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-5 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-12">
          <div className="aspect-[2/3] animate-pulse rounded-lg bg-muted" />
          <div className="space-y-3 self-center">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </Container>
    </div>
  )
}
