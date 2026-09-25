import { History } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '@/components/common/Container'
import { SectionHeading } from '@/components/common/SectionHeading'
import { StoryCover } from '@/features/stories/StoryCover'
import { paths } from '@/lib/routes'
import { useReadingHistory } from '../hooks'
import { resumeState } from '../resume'
import { ProgressMeter } from './ProgressMeter'

/** Trang chủ: các truyện đang đọc dở (ẩn khi chưa đọc gì) */
export function ContinueReading() {
  const { data } = useReadingHistory(4)
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
