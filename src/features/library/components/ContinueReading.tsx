import { History } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '@/components/common/Container'
import { SectionHeading } from '@/components/common/SectionHeading'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import { paths } from '@/lib/routes'
import { useReadingHistory } from '../hooks'
import { resumeState } from '../resume'
import { ProgressMeter } from './ProgressMeter'

const LIMIT = 4

/** Trang chủ: các truyện đang đọc dở (ẩn khi chưa đọc gì) */
export function ContinueReading() {
  const { data: user, isPending: sessionPending } = useSession()
  const { data, isPending } = useReadingHistory(LIMIT)
  // Giữ chỗ khi còn chờ phiên, hoặc đã đăng nhập mà lịch sử chưa về: khối không chen vào sau banner.
  // Khách thì không giữ chỗ (phần lớn khách chưa đọc gì, khung chờ sẽ co lại ngay)
  if (sessionPending || (user && isPending)) return <ContinueReadingSkeleton />
  if (!data?.length) return null

  return (
    <Container className="mt-12">
      <section aria-labelledby="continue-reading">
        <SectionHeading
          id="continue-reading"
          icon={<History className="size-6 text-rose-gold" aria-hidden />}
          moreTo={paths.readingHistory}
        >
          Đọc tiếp
        </SectionHeading>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.map(({ story, progress }) => (
            <li key={story.slug}>
              <Link
                to={paths.chapter(story.slug, progress.chapter)}
                state={resumeState(progress)}
                className="group flex h-full items-center gap-3 rounded-xl border bg-card/50 p-3 transition-colors hover:border-primary/50"
              >
                <StoryCover story={story} compact className="w-12 shrink-0 rounded" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-medium group-hover:text-primary">
                    {story.title}
                  </span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    Chương {progress.chapter}
                    {progress.chapterTitle && `: ${progress.chapterTitle}`}
                  </span>
                  <ProgressMeter value={progress.progress} className="mt-2" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  )
}

function ContinueReadingSkeleton() {
  return (
    <Container className="mt-12" aria-hidden>
      <div className="mb-5 flex items-end justify-between gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: LIMIT }, (_, i) => (
          // Cùng khung với thẻ thật: bìa w-12 (cao 72px) + tên, chương, thanh tiến độ
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card/50 p-3">
            <Skeleton className="aspect-[2/3] w-12 shrink-0 rounded" />
            <div className="min-w-0 flex-1">
              <Skeleton className="my-0.5 h-5 w-3/4" />
              <Skeleton className="my-0.5 h-3 w-1/2" />
              <div className="mt-2 flex h-4 items-center">
                <Skeleton className="h-1 w-full rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}
