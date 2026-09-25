import { CalendarDays, Clock, Type } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import { formatDate } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ChapterContent } from '@/types/chapter'
import { fonts } from '../readerOptions'
import { countWords, toParagraphs } from '../text'
import { useReaderSettings } from '../useReaderSettings'

const WORDS_PER_MINUTE = 220

type Props = {
  chapter: ChapterContent
  /** Thanh chuyển chương đặt giữa phần đầu chương và nội dung */
  nav?: ReactNode
  /** Chạm vào vùng chữ (không bôi đen, không bấm link) để ẩn/hiện thanh công cụ */
  onTap?: () => void
  /** Đoạn đang được đọc to (tô nền) */
  activeParagraph?: number
  /** Cuộn liên tục: chỉ chương đầu là h1, các chương nối sau là h2 */
  headingLevel?: 1 | 2
}

export function ChapterArticle({ chapter, nav, onTap, activeParagraph, headingLevel = 1 }: Props) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const { font, fontSize, lineHeight } = useReaderSettings()
  const paragraphs = toParagraphs(chapter.content)
  const words = countWords(chapter.content)
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  // Chữ hoa đầu chương chỉ khi đoạn đầu mở bằng chữ cái (không phải lời thoại "— ...")
  const dropCap = /^\p{L}/u.test(paragraphs[0] ?? '')

  function handleClick(e: MouseEvent) {
    if (!onTap || window.getSelection()?.toString()) return
    if ((e.target as HTMLElement).closest('a, button')) return
    onTap()
  }

  return (
    <article data-chapter={chapter.number} aria-labelledby={`chapter-${chapter.number}-title`}>
      <header className="text-center">
        <Link
          to={paths.story(chapter.story.slug)}
          className="text-sm text-rose-gold underline-offset-4 hover:underline"
        >
          {chapter.story.title}
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">Chương {chapter.number}</p>
        <Heading
          id={`chapter-${chapter.number}-title`}
          className="mt-1 font-heading text-4xl leading-tight font-semibold text-balance sm:text-5xl"
        >
          {chapter.title}
        </Heading>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            <span className="sr-only">Đăng ngày </span>
            {formatDate(chapter.publishedAt)}
          </li>
          <li className="flex items-center gap-1.5">
            <Type className="size-3.5" aria-hidden />
            {words.toLocaleString('vi-VN')} chữ
          </li>
          <li className="flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            khoảng {minutes} phút đọc
          </li>
        </ul>
        <svg
          aria-hidden
          viewBox="0 0 120 12"
          className="mx-auto mt-8 h-3 w-28 text-rose-gold/60"
          fill="none"
          stroke="currentColor"
        >
          <path d="M0 6h48M72 6h48" strokeWidth="1" />
          <path d="M60 1l5 5-5 5-5-5z" fill="currentColor" stroke="none" />
        </svg>
      </header>
      {nav && <div className="mt-8">{nav}</div>}
      <div
        onClick={handleClick}
        className={cn(
          'mt-8 text-pretty break-words [&>p+p]:mt-[0.95em]',
          fonts.find((f) => f.value === font)?.className,
          dropCap &&
            'first-letter:float-left first-letter:mt-[0.08em] first-letter:mr-[0.12em] first-letter:font-heading first-letter:text-[3.6em] first-letter:leading-[0.82] first-letter:font-semibold first-letter:text-rose-gold',
        )}
        style={{ fontSize, lineHeight }}
      >
        {paragraphs.map((p, i) => (
          <p
            key={i}
            data-paragraph={i}
            className={cn(
              'rounded-sm whitespace-pre-line transition-colors duration-300',
              i === activeParagraph &&
                'bg-primary/10 shadow-[0_0_0_0.35em] shadow-primary/10 motion-reduce:transition-none',
            )}
          >
            {p}
          </p>
        ))}
      </div>
    </article>
  )
}
