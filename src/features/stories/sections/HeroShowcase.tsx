import { BookOpen, Eye, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Container } from '@/components/common/Container'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FollowButton } from '@/features/library/components/FollowButton'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { useFeaturedStories } from '../hooks'
import { coverPalette } from '../coverPalette'
import { StoryCover } from '../StoryCover'

const SLIDE_MS = 7000

export function HeroShowcase() {
  const { data: stories, isPending, isError } = useFeaturedStories()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  if (isPending) return <HeroSkeleton />
  if (isError || stories.length === 0) return null

  // Danh sách tải lại có thể ít đi (vd truyện bị ẩn) khi đang ở slide cuối: kẹp về slide cuối mới
  const current = Math.min(index, stories.length - 1)
  const story = stories[current]
  const p = coverPalette(story.slug)
  const next = () => setIndex((current + 1) % stories.length)

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Truyện nổi bật"
      className="relative isolate overflow-hidden border-b"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Nền: phóng to bảng màu bìa + quầng sáng hồng neon */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 transition-[background] duration-700"
        style={{ background: `linear-gradient(115deg, ${p.to} 10%, ${p.from} 55%, ${p.to} 100%)` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_85%_40%,color-mix(in_srgb,var(--neon)_22%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-background/70"
      />

      <Container className="grid items-center gap-10 py-12 text-[#f4e7ed] md:grid-cols-[1fr_auto] lg:gap-16 lg:py-20">
        <div
          key={story.slug}
          aria-roledescription="slide"
          aria-label={`${current + 1} / ${stories.length}`}
          className="motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in"
        >
          <p className="flex flex-wrap gap-x-3 text-sm text-[#d9a68f]">
            {story.genres.map((g) => (
              <Link key={g.slug} to={paths.genre(g.slug)} className="hover:underline">
                {g.name}
              </Link>
            ))}
          </p>
          <h2 className="mt-4 max-w-2xl font-heading text-4xl leading-[0.95] font-semibold text-balance [text-shadow:0_0_40px_rgb(255_61_139/0.45)] sm:text-5xl lg:text-7xl">
            <Link to={paths.story(story.slug)}>{story.title}</Link>
          </h2>
          <p className="mt-4 text-[#f4e7ed]/80">
            của{' '}
            <span className="font-heading text-xl font-semibold text-[#f4e7ed] italic">
              {story.author.name}
            </span>
          </p>
          <p className="mt-5 line-clamp-3 max-w-xl leading-relaxed text-[#f4e7ed]/75">
            {story.description}
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#f4e7ed]/80">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Đánh giá</dt>
              <Star className="size-4 fill-[#d9a68f] text-[#d9a68f]" aria-hidden />
              <dd>
                {story.ratingAvg.toFixed(1)}{' '}
                <span className="text-[#f4e7ed]/55">({formatCount(story.ratingCount)})</span>
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
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              className="h-11 rounded-full bg-[#ff3d8b] px-6 text-[#1a0f1d] shadow-[0_0_30px_rgb(255_61_139/0.45)] hover:bg-[#ff5c9e]"
            >
              <Link to={paths.chapter(story.slug, story.firstChapterNumber ?? 1)}>
                <BookOpen />
                Đọc từ chương {story.firstChapterNumber ?? 1}
              </Link>
            </Button>
            <FollowButton slug={story.slug} onDark />
          </div>
        </div>

        <Link
          to={paths.story(story.slug)}
          tabIndex={-1}
          aria-hidden
          className="hidden w-56 -rotate-3 overflow-hidden rounded-xl shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7),0_0_60px_-10px_rgb(255_61_139/0.35)] ring-1 ring-white/10 transition-transform duration-500 hover:rotate-0 md:block lg:w-72"
        >
          <StoryCover
            key={story.slug}
            story={story}
            priority
            className="motion-safe:animate-in motion-safe:duration-700 motion-safe:zoom-in-95 motion-safe:fade-in"
          />
        </Link>
      </Container>

      {/* Chọn slide: bìa nhỏ + thanh tiến độ; hết thanh thì sang slide kế */}
      <Container className="pb-8">
        <div className="flex gap-3" role="tablist" aria-label="Chọn truyện nổi bật">
          {stories.map((s, i) => {
            const active = i === current
            return (
              <button
                key={s.slug}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={s.title}
                onClick={() => setIndex(i)}
                className={cn(
                  'group relative w-12 overflow-hidden rounded-md ring-1 transition sm:w-14',
                  active ? 'ring-[#ff3d8b]' : 'opacity-55 ring-white/15 hover:opacity-90',
                )}
              >
                <StoryCover story={s} compact />
                {active && !reducedMotion && (
                  <span
                    aria-hidden
                    onAnimationEnd={next}
                    className="absolute inset-x-0 bottom-0 h-1 origin-left animate-hero-progress bg-[#ff3d8b]"
                    style={{
                      animationDuration: `${SLIDE_MS}ms`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

/** Khung chờ cùng chiều cao với banner thật (kể cả hàng nút và dải bìa nhỏ) để trang không nhảy */
function HeroSkeleton() {
  return (
    <div aria-hidden className="border-b bg-muted/40">
      <Container className="grid items-center gap-10 py-12 md:grid-cols-[1fr_auto] lg:gap-16 lg:py-20">
        <div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-[2.15rem] w-3/4 sm:h-[2.85rem] lg:h-[4.3rem]" />
          <Skeleton className="mt-4 h-7 w-1/3" />
          <Skeleton className="mt-5 h-[4.875rem] w-full max-w-xl" />
          <Skeleton className="mt-6 h-5 w-full max-w-sm" />
          <div className="mt-8 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-48 rounded-full" />
            <Skeleton className="h-11 w-52 rounded-full" />
          </div>
        </div>
        <Skeleton className="hidden aspect-[2/3] w-56 rounded-xl md:block lg:w-72" />
      </Container>
      <Container className="pb-8">
        <div className="flex gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-12 sm:w-14" />
          ))}
        </div>
      </Container>
    </div>
  )
}
