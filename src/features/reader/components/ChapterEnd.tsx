import { ArrowRight, BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { FollowButton } from '@/features/library/components/FollowButton'
import { paths } from '@/lib/routes'
import type { ChapterContent } from '@/types/chapter'

/** Cuối chương: mời đọc chương kế, hoặc báo đã đọc tới chương mới nhất */
export function ChapterEnd({ chapter }: { chapter: ChapterContent }) {
  const { story, next } = chapter

  return (
    <section aria-label="Hết chương" className="text-center">
      <p className="text-sm text-muted-foreground">Hết chương {chapter.number}</p>

      {next ? (
        <Link
          to={paths.chapter(story.slug, next.number)}
          className="group mt-6 block rounded-2xl border bg-card px-6 py-7 text-card-foreground transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <span className="text-sm text-muted-foreground">Đọc tiếp chương {next.number}</span>
          <span className="mt-1 flex items-center justify-center gap-2 font-heading text-2xl font-semibold text-balance sm:text-3xl">
            {next.title}
            <ArrowRight
              className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </span>
        </Link>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed px-6 py-7">
          <p className="font-heading text-2xl font-semibold">
            {story.status === 'completed'
              ? 'Bạn đã đọc hết truyện'
              : 'Bạn đã đọc tới chương mới nhất'}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {story.status === 'completed'
              ? `Cảm ơn bạn đã đồng hành cùng ${story.title}. Hãy để lại đánh giá cho tác giả nhé.`
              : 'Theo dõi truyện để thấy ngay trong tủ truyện khi có chương mới.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {story.status !== 'completed' && <FollowButton slug={story.slug} />}
            <Button asChild variant="outline" className="h-11 rounded-full px-5">
              <Link to={paths.story(story.slug)}>
                <BookOpen />
                Về trang truyện
              </Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
