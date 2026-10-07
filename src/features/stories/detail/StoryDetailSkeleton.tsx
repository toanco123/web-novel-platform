import { Container } from '@/components/common/Container'
import { Skeleton } from '@/components/ui/skeleton'
import { ChapterRowSkeleton, PaginationSkeleton } from '@/features/chapters/components/ChapterList'
import { cn } from '@/lib/utils'
import { StoryListItemsSkeleton } from './SideStoryList'
import { StoryHeroSkeleton } from './StoryHero'

/**
 * Khung chờ cả trang chi tiết truyện (cùng bố cục StoryDetailPage): phần đầu, thanh mục lục, giới
 * thiệu, danh sách chương và cột phụ, để chân trang không nhảy lên rồi bị đẩy xuống
 */
export function StoryDetailSkeleton({ slug }: { slug: string }) {
  return (
    <div aria-busy>
      <p role="status" className="sr-only">
        Đang tải truyện…
      </p>
      <StoryHeroSkeleton slug={slug} />

      <div className="border-b" aria-hidden>
        <Container>
          <div className="flex gap-1 py-2">
            {['w-28', 'w-40', 'w-28'].map((w, i) => (
              <Skeleton key={i} className={cn('h-9 rounded-full', w)} />
            ))}
          </div>
        </Container>
      </div>

      <Container className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden>
        <div className="min-w-0 space-y-16">
          <section>
            <HeadingSkeleton className="w-40" />
            <div className="max-w-prose space-y-2.5">
              {['w-full', 'w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-2/3'].map((w, i) => (
                <Skeleton key={i} className={cn('h-4', w)} />
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              {['w-20', 'w-24', 'w-16'].map((w) => (
                <Skeleton key={w} className={cn('h-9 rounded-full', w)} />
              ))}
            </div>
          </section>

          <section>
            <HeadingSkeleton className="w-60" />
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-9 w-44 rounded-full" />
              <Skeleton className="h-9 w-48 rounded-full" />
            </div>
            <ol className="grid gap-x-6 divide-y md:grid-cols-2 md:divide-y-0">
              {Array.from({ length: 20 }, (_, i) => (
                <ChapterRowSkeleton key={i} />
              ))}
            </ol>
            <PaginationSkeleton />
          </section>
        </div>

        <aside className="grid content-start gap-10 md:grid-cols-2 lg:grid-cols-1">
          {[3, 6].map((count) => (
            <section key={count}>
              <Skeleton className="mb-3 h-8 w-36" />
              <StoryListItemsSkeleton count={count} />
            </section>
          ))}
        </aside>
      </Container>
    </div>
  )
}

/** Cùng cỡ SectionHeading (font-heading text-3xl, mb-5) */
function HeadingSkeleton({ className }: { className?: string }) {
  return (
    <div className="mb-5 flex h-9 items-end">
      <Skeleton className={cn('h-8', className)} />
    </div>
  )
}
