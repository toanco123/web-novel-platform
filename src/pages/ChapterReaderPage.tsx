import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useChapter, usePrefetchChapter, useRecordChapterView } from '@/features/chapters/hooks'
import { ReportChapterDialog } from '@/features/feedback/components/ReportChapterDialog'
import { ChapterArticle } from '@/features/reader/components/ChapterArticle'
import { ChapterComments } from '@/features/reader/components/ChapterComments'
import { ChapterEnd } from '@/features/reader/components/ChapterEnd'
import { ChapterNav } from '@/features/reader/components/ChapterNav'
import { ChapterStream } from '@/features/reader/components/ChapterStream'
import { ReaderToolbar, type ReaderPanel } from '@/features/reader/components/ReaderToolbar'
import { ReadingProgress } from '@/features/reader/components/ReadingProgress'
import { ResumeNotice } from '@/features/reader/components/ResumeNotice'
import { SpeechBar } from '@/features/reader/components/SpeechBar'
import { firstVisibleParagraph, paragraphElement } from '@/features/reader/progress'
import { widths } from '@/features/reader/readerOptions'
import { useChapterSpeech } from '@/features/reader/speech/useChapterSpeech'
import { useAutoHideToolbar } from '@/features/reader/useAutoHideToolbar'
import { useChapterKeys } from '@/features/reader/useChapterKeys'
import { useReaderSettings } from '@/features/reader/useReaderSettings'
import { useReadingTracker } from '@/features/reader/useReadingTracker'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ChapterContent } from '@/types/chapter'

// Router không hỗ trợ tham số nằm giữa đoạn URL ("chuong-:number") nên tự tách ở đây
const parseChapterSegment = (segment: string) => {
  const match = /^chuong-(\d{1,6})$/.exec(segment)
  return match ? Number(match[1]) : null
}

/**
 * state khi điều hướng trong trang đọc:
 * - stream: cuộn liên tục tự đổi URL theo chương đang đọc (không bắt đầu lại chuỗi chương)
 * - speech: giọng đọc tự chuyển sang chương sau (không dừng đọc)
 */
type ReaderNavState = { stream?: boolean; speech?: boolean } | null

export default function ChapterReaderPage() {
  const { slug = '', chapter = '' } = useParams()
  const number = parseChapterSegment(chapter)
  if (number === null) return <NotFound message="Đường dẫn chương không hợp lệ." />
  return <Reader slug={slug} number={number} />
}

function Reader({ slug, number }: { slug: string; number: number }) {
  const { data: chapter, isPending, isError, refetch } = useChapter(slug, number)
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as ReaderNavState
  const [toolbarVisible, setToolbarVisible] = useAutoHideToolbar()
  // Gắn bảng đang mở với số chương: chuyển sang chương khác là bảng tự đóng
  const [panel, setPanel] = useState<{ name: ReaderPanel; chapter: number } | null>(null)
  const open = panel?.chapter === number ? panel.name : null
  const setOpen = (name: ReaderPanel | null) => setPanel(name ? { name, chapter: number } : null)
  const width = useReaderSettings((s) => s.width)
  const continuous = useReaderSettings((s) => s.continuous)
  const reducedMotion = usePrefersReducedMotion()

  // Cuộn liên tục: chuỗi chương bắt đầu lại khi điều hướng không phải do chính việc cuộn
  const [streamStart, setStreamStart] = useState(number)
  if (!navState?.stream && streamStart !== number) setStreamStart(number)

  const speech = useChapterSpeech(slug, (next) => {
    // Từng chương: mở trang chương sau; cuộn liên tục: chương sau được nối vào bên dưới
    if (!useReaderSettings.getState().continuous) {
      navigate(paths.chapter(slug, next), { state: { speech: true } })
    }
  })

  // Người đọc tự chuyển sang chương khác (mục lục, phím, link) khi đang nghe thì dừng đọc
  const speechRef = useRef(speech)
  useEffect(() => {
    speechRef.current = speech
  })
  useEffect(() => {
    const { status, chapter: speaking, stop } = speechRef.current
    if (status === 'idle' || navState?.stream || navState?.speech) return
    if (speaking !== number) stop()
  }, [location.key, number, navState])

  // Đoạn đang đọc luôn ở giữa màn hình
  useEffect(() => {
    if (speech.status !== 'playing' || speech.chapter === null) return
    paragraphElement(speech.chapter, speech.paragraph)?.scrollIntoView({
      block: 'center',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [speech.status, speech.chapter, speech.paragraph, reducedMotion, chapter])

  usePrefetchChapter(slug, chapter?.next?.number)
  useChapterKeys(slug, chapter?.prev?.number, chapter?.next?.number)
  useRecordChapterView(slug, chapter ? number : undefined)
  const resumed = useReadingTracker(chapter)

  if (isPending) return <ReaderSkeleton />
  if (isError)
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-32 text-center">
        <p>Không tải được chương này.</p>
        <Button className="rounded-full" onClick={() => void refetch()}>
          Thử lại
        </Button>
      </div>
    )
  if (!chapter)
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-32 text-center">
        <title>{`Không tìm thấy chương | ${SITE_NAME}`}</title>
        <p className="font-heading text-6xl font-semibold text-muted-foreground">404</p>
        <p>Không tìm thấy chương {number}. Có thể chương đã bị ẩn hoặc chưa được đăng.</p>
        <Button asChild className="rounded-full">
          <Link to={paths.story(slug)}>Về trang truyện</Link>
        </Button>
      </div>
    )

  const openIndex = () => setOpen('index')
  const toggleToolbar = () => setToolbarVisible((v) => !v)
  const listening = speech.status !== 'idle'
  const listen = speech.supported
    ? {
        active: listening,
        onClick: () => {
          if (speech.status === 'playing') speech.pause()
          else if (speech.status === 'paused') speech.resume()
          else speech.start(number, firstVisibleParagraph(number))
        },
      }
    : undefined

  return (
    <>
      <title>{`Chương ${chapter.number}: ${chapter.title} - ${chapter.story.title} | ${SITE_NAME}`}</title>
      <meta
        name="description"
        content={`Đọc chương ${chapter.number} "${chapter.title}" của truyện ${chapter.story.title} (${chapter.story.author.name}).`}
      />
      {chapter.prev && <link rel="prev" href={paths.chapter(slug, chapter.prev.number)} />}
      {chapter.next && <link rel="next" href={paths.chapter(slug, chapter.next.number)} />}

      <ReadingProgress chapter={number} />
      <ReaderToolbar
        chapter={chapter}
        visible={toolbarVisible}
        open={open}
        setOpen={setOpen}
        listen={listen}
      />
      {resumed && <ResumeNotice key={location.key} chapter={number} />}

      <main
        id="chapter-content"
        className={cn('mx-auto px-5 pt-24 pb-20 sm:px-8 sm:pt-28', listening && 'pb-36')}
        style={{ maxWidth: `calc(${widths.find((w) => w.value === width)?.maxWidth} + 4rem)` }}
      >
        {continuous ? (
          <ChapterStream
            key={streamStart}
            slug={slug}
            start={streamStart}
            current={number}
            speaking={speech}
            onTap={toggleToolbar}
            onOpenIndex={openIndex}
          />
        ) : (
          <SingleChapter
            chapter={chapter}
            activeParagraph={speech.chapter === number ? speech.paragraph : undefined}
            onTap={toggleToolbar}
            onOpenIndex={openIndex}
          />
        )}
      </main>

      {listening && <SpeechBar speech={speech} />}
    </>
  )
}

/** Chế độ từng chương: một chương, cuối chương có thanh chuyển chương, báo lỗi, bình luận */
function SingleChapter({
  chapter,
  activeParagraph,
  onTap,
  onOpenIndex,
}: {
  chapter: ChapterContent
  activeParagraph: number | undefined
  onTap: () => void
  onOpenIndex: () => void
}) {
  const slug = chapter.story.slug
  return (
    <>
      <ChapterArticle
        chapter={chapter}
        nav={<ChapterNav chapter={chapter} onOpenIndex={onOpenIndex} label="Chuyển chương (đầu)" />}
        onTap={onTap}
        activeParagraph={activeParagraph}
      />
      <div className="mt-16 space-y-10">
        <ChapterEnd chapter={chapter} />
        <ChapterNav
          chapter={chapter}
          onOpenIndex={onOpenIndex}
          label="Chuyển chương (cuối)"
          emphasizeNext={!chapter.next}
        />
        <div className="flex justify-center">
          <ReportChapterDialog slug={slug} chapter={chapter.number} />
        </div>
      </div>
      <div className="mt-16 border-t pt-12">
        <ChapterComments key={chapter.number} slug={slug} chapter={chapter.number} />
      </div>
    </>
  )
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-28 pb-20" aria-busy aria-label="Đang tải chương">
      <div className="mx-auto h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="mx-auto mt-6 h-10 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-14 space-y-3">
        {Array.from({ length: 14 }, (_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-muted"
            style={{ width: i % 5 === 4 ? '60%' : '100%' }}
          />
        ))}
      </div>
    </div>
  )
}
