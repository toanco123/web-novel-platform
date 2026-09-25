import { ChevronsDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { ReportChapterDialog } from '@/features/feedback/components/ReportChapterDialog'
import { useChapter } from '@/features/chapters/hooks'
import { paths } from '@/lib/routes'
import { ChapterArticle } from './ChapterArticle'
import { ChapterComments } from './ChapterComments'
import { ChapterEnd } from './ChapterEnd'
import { ChapterNav } from './ChapterNav'

type Props = {
  slug: string
  /** Chương đầu tiên của chuỗi (chương mở ra từ link/mục lục) */
  start: number
  /** Chương hiện tại theo URL */
  current: number
  /** Đoạn đang được đọc to, để tô nền và nối chương kịp khi giọng đọc sang chương sau */
  speaking: { chapter: number | null; paragraph: number }
  onTap: () => void
  onOpenIndex: () => void
}

/** Khi đỉnh chương vượt qua mốc này (tính từ mép trên màn hình) thì coi là đang đọc chương đó */
const CURRENT_LINE = 0.4

/**
 * Chế độ cuộn liên tục: đọc gần hết thì chương sau tự nối vào bên dưới. Chương đang ở giữa
 * màn hình được đưa lên URL (thay mục lịch sử, không cuộn) để thanh công cụ, lịch sử đọc,
 * tiêu đề tab đi theo.
 */
export function ChapterStream({ slug, start, current, speaking, onTap, onOpenIndex }: Props) {
  const navigate = useNavigate()
  const [numbers, setNumbers] = useState([start])
  const { data: last } = useChapter(slug, numbers[numbers.length - 1])
  const nextNumber = last?.next?.number
  const append = useCallback(
    (n: number) => setNumbers((list) => (list.includes(n) ? list : [...list, n])),
    [],
  )

  // Còn khoảng 1,5 màn hình tới cuối thì tải chương sau
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (nextNumber === undefined || !el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) append(nextNumber)
      },
      { rootMargin: '0px 0px 150% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [nextNumber, append])

  // Giọng đọc đã sang chương sau mà chương đó chưa được nối
  if (
    nextNumber !== undefined &&
    speaking.chapter === nextNumber &&
    !numbers.includes(nextNumber)
  ) {
    setNumbers([...numbers, nextNumber])
  }

  const currentRef = useRef(current)
  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const line = window.innerHeight * CURRENT_LINE
        let found: number | null = null
        for (const el of document.querySelectorAll<HTMLElement>('[data-chapter]')) {
          if (el.getBoundingClientRect().top <= line) found = Number(el.dataset.chapter)
        }
        if (found !== null && found !== currentRef.current) {
          navigate(paths.chapter(slug, found), {
            replace: true,
            preventScrollReset: true,
            state: { stream: true },
          })
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [navigate, slug])

  return (
    <>
      {numbers.map((n, i) => (
        <StreamChapter
          key={n}
          slug={slug}
          number={n}
          first={i === 0}
          activeParagraph={speaking.chapter === n ? speaking.paragraph : undefined}
          onTap={onTap}
          onOpenIndex={onOpenIndex}
        />
      ))}
      <div ref={sentinelRef} aria-hidden />
      {nextNumber !== undefined && (
        <div className="mt-12 flex justify-center">
          <Button
            variant="outline"
            className="h-10 rounded-full px-5"
            onClick={() => append(nextNumber)}
          >
            <ChevronsDown />
            Tải chương {nextNumber}
          </Button>
        </div>
      )}
    </>
  )
}

function StreamChapter({
  slug,
  number,
  first,
  activeParagraph,
  onTap,
  onOpenIndex,
}: {
  slug: string
  number: number
  first: boolean
  activeParagraph: number | undefined
  onTap: () => void
  onOpenIndex: () => void
}) {
  const { data: chapter, isPending, isError, refetch } = useChapter(slug, number)

  if (isPending) {
    return (
      <div className="mt-24 space-y-3" aria-busy aria-label={`Đang tải chương ${number}`}>
        <div className="mx-auto h-10 w-2/3 animate-pulse rounded bg-muted" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted" />
        ))}
      </div>
    )
  }
  if (isError || !chapter) {
    return (
      <div className="mt-24 flex flex-col items-center gap-3 text-center">
        <p>Không tải được chương {number}.</p>
        <Button variant="outline" className="rounded-full" onClick={() => void refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div className={first ? undefined : 'mt-24'}>
      <ChapterArticle
        chapter={chapter}
        headingLevel={first ? 1 : 2}
        nav={
          first ? (
            <ChapterNav chapter={chapter} onOpenIndex={onOpenIndex} label="Chuyển chương (đầu)" />
          ) : undefined
        }
        onTap={onTap}
        activeParagraph={activeParagraph}
      />
      {chapter.next ? (
        <div className="mt-14 flex flex-col items-center gap-4 text-center">
          <p className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            Hết chương {chapter.number}
            <span className="h-px w-10 bg-border" aria-hidden />
          </p>
          <div className="flex w-full flex-col items-center gap-4">
            <ChapterComments slug={slug} chapter={chapter.number} collapsible />
            <ReportChapterDialog slug={slug} chapter={chapter.number} />
          </div>
        </div>
      ) : (
        <div className="mt-16 space-y-10">
          <ChapterEnd chapter={chapter} />
          <ChapterNav
            chapter={chapter}
            onOpenIndex={onOpenIndex}
            label="Chuyển chương (cuối)"
            emphasizeNext={false}
          />
          <div className="flex justify-center">
            <ReportChapterDialog slug={slug} chapter={chapter.number} />
          </div>
          <ChapterComments slug={slug} chapter={chapter.number} />
        </div>
      )}
    </div>
  )
}
