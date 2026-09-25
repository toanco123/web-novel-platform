import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/routes'
import type { ChapterContent } from '@/types/chapter'

type Props = {
  chapter: ChapterContent
  onOpenIndex: () => void
  label: string
  /** Tô nổi nút "Chương sau"; tắt khi bên dưới đã có thẻ "Đọc tiếp" làm nút chính */
  emphasizeNext?: boolean
}

const navButton = 'h-10 flex-1 rounded-full sm:flex-none sm:px-5'

/** Chương trước · mục lục · chương sau (dùng ở đầu và cuối chương) */
export function ChapterNav({ chapter, onOpenIndex, label, emphasizeNext = true }: Props) {
  const { story, prev, next } = chapter
  const nextVariant = emphasizeNext ? 'default' : 'outline'
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-2">
      {prev ? (
        <Button asChild variant="outline" className={navButton}>
          <Link to={paths.chapter(story.slug, prev.number)} rel="prev">
            <ChevronLeft />
            <span>
              <span className="sm:hidden">Trước</span>
              <span className="hidden sm:inline">Chương trước</span>
            </span>
          </Link>
        </Button>
      ) : (
        <Button variant="outline" className={navButton} disabled>
          <ChevronLeft />
          <span>
            <span className="sm:hidden">Trước</span>
            <span className="hidden sm:inline">Chương trước</span>
          </span>
        </Button>
      )}

      <Button
        variant="ghost"
        className="h-10 shrink-0 rounded-full px-3 text-muted-foreground tabular-nums"
        onClick={onOpenIndex}
        aria-label={`Mục lục, đang ở chương ${chapter.number} trên ${story.chapterCount}`}
      >
        <ListOrdered />
        {chapter.number}/{story.chapterCount}
      </Button>

      {next ? (
        <Button asChild variant={nextVariant} className={navButton}>
          <Link to={paths.chapter(story.slug, next.number)} rel="next">
            <span>
              <span className="sm:hidden">Sau</span>
              <span className="hidden sm:inline">Chương sau</span>
            </span>
            <ChevronRight />
          </Link>
        </Button>
      ) : (
        <Button variant={nextVariant} className={navButton} disabled>
          <span>
            <span className="sm:hidden">Sau</span>
            <span className="hidden sm:inline">Chương sau</span>
          </span>
          <ChevronRight />
        </Button>
      )}
    </nav>
  )
}
