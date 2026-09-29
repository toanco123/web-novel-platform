import { CalendarDays, Clock, Type } from 'lucide-react'
import { Fragment, useMemo, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { blockTexts, parseContent, type Inline, type ListStyle } from '@/features/chapters/richText'
import { formatDate } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ChapterContent } from '@/types/chapter'
import { fonts } from '../readerOptions'
import { countWords, WORDS_PER_MINUTE } from '../text'
import { useReaderSettings } from '../useReaderSettings'

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
  const blocks = useMemo(() => parseContent(chapter.content), [chapter.content])
  const words = countWords(blockTexts(blocks).join(' '))
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  // Chữ hoa đầu chương chỉ khi khối đầu là đoạn văn mở bằng chữ cái (không phải lời thoại "— ...")
  const first = blocks[0]
  const dropCap =
    first?.type === 'paragraph' && !first.align && /^\p{L}/u.test(first.inlines[0]?.text ?? '')
  // Tiêu đề trong chương thấp hơn tên chương một/hai cấp
  const HeadingLarge = headingLevel === 1 ? 'h2' : 'h3'
  const HeadingSmall = headingLevel === 1 ? 'h3' : 'h4'
  // Mỗi đoạn, tiêu đề, mục danh sách là một đơn vị đọc: `data-paragraph` đánh số liên tục
  let unit = 0
  const unitProps = (className?: string) => {
    const i = unit++
    return {
      'data-paragraph': i,
      className: cn(
        'rounded-sm whitespace-pre-line transition-colors duration-300',
        i === activeParagraph &&
          'bg-primary/10 shadow-[0_0_0_0.35em] shadow-primary/10 motion-reduce:transition-none',
        className,
      ),
    }
  }

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
          'mt-8 text-pretty break-words [&>*+*]:mt-[0.95em] [&>*+:is(h2,h3,h4)]:mt-[1.6em]',
          fonts.find((f) => f.value === font)?.className,
          dropCap &&
            'first-letter:float-left first-letter:mt-[0.08em] first-letter:mr-[0.12em] first-letter:font-heading first-letter:text-[3.6em] first-letter:leading-[0.82] first-letter:font-semibold first-letter:text-rose-gold',
        )}
        style={{ fontSize, lineHeight }}
      >
        {blocks.map((b, k) => {
          if (b.type === 'list') {
            const List = b.ordered ? 'ol' : 'ul'
            return (
              <List
                key={k}
                className={cn(
                  'space-y-[0.4em] pl-[1.6em]',
                  listStyleClass[b.style ?? (b.ordered ? 'decimal' : 'disc')],
                )}
              >
                {b.items.map((item, j) => (
                  <li key={j} {...unitProps('pl-[0.2em]')}>
                    <Inlines inlines={item} />
                  </li>
                ))}
              </List>
            )
          }
          const Tag = b.type === 'paragraph' ? 'p' : b.level === 2 ? HeadingLarge : HeadingSmall
          return (
            <Tag
              key={k}
              {...unitProps(
                cn(
                  b.type === 'heading' && 'font-heading leading-snug font-bold text-balance',
                  b.type === 'heading' && (b.level === 2 ? 'text-[1.4em]' : 'text-[1.2em]'),
                  b.align === 'center' && 'text-center',
                ),
              )}
            >
              <Inlines inlines={b.inlines} />
            </Tag>
          )
        })}
      </div>
    </article>
  )
}

const listStyleClass: Record<ListStyle, string> = {
  disc: 'list-disc',
  circle: 'list-[circle]',
  square: 'list-[square]',
  decimal: 'list-decimal',
  'lower-alpha': 'list-[lower-alpha]',
  'lower-roman': 'list-[lower-roman]',
  'upper-roman': 'list-[upper-roman]',
}

/** Chữ có định dạng; nội dung luôn là chữ (React tự escape), không render HTML */
function Inlines({ inlines }: { inlines: Inline[] }) {
  return inlines.map((inline, i) => {
    let node: ReactNode = inline.text
    if (inline.strike) node = <s>{node}</s>
    if (inline.underline) node = <u className="underline-offset-[0.2em]">{node}</u>
    if (inline.italic) node = <em>{node}</em>
    if (inline.bold) node = <strong className="font-semibold">{node}</strong>
    return <Fragment key={i}>{node}</Fragment>
  })
}
