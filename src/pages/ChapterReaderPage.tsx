import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useChapter, useRecordChapterView } from '@/features/chapters/hooks'
import { ReportChapterDialog } from '@/features/feedback/components/ReportChapterDialog'
import { NotSavedNotice } from '@/features/offline/components/NotSavedNotice'
import { usePrefetchChapters } from '@/features/offline/prefetch'
import { ChapterNotSavedError } from '@/features/offline/readChapter'
import { useAutoScroll } from '@/features/reader/autoscroll/useAutoScroll'
import { AutoScrollBar } from '@/features/reader/components/AutoScrollBar'
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
import { Seo } from '@/components/common/Seo'
import { chapterSeo } from '@/lib/seo'

// Router không hỗ trợ tham số nằm giữa đoạn URL ("chapter-:number") nên tự tách ở đây
const parseChapterSegment = (segment: string) => {
  const match = /^chapter-(\d{1,6})$/.exec(segment)
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
  const { data: chapter, isPending, isError, error, refetch } = useChapter(slug, number)
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as ReaderNavState
  const width = useReaderSettings((s) => s.width)
  const continuous = useReaderSettings((s) => s.continuous)
  const autoScroll = useAutoScroll(number, continuous)
  const [toolbarVisible, setToolbarVisible] = useAutoHideToolbar(autoScroll.status === 'running')
  // Gắn bảng đang mở với số chương: chuyển sang chương khác là bảng tự đóng
  const [panel, setPanel] = useState<{ name: ReaderPanel; chapter: number } | null>(null)
  const open = panel?.chapter === number ? panel.name : null
  const setOpen = (name: ReaderPanel | null) => setPanel(name ? { name, chapter: number } : null)
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

  // Nút "Chương sau" trên thanh tự cuộn: sang chương đó rồi cuộn tiếp từ đầu chương.
  // Người đọc tự chuyển chương cách khác (mục lục, phím, link) thì tạm dừng
  const continueAt = useRef<number | null>(null)
  const autoScrollRef = useRef(autoScroll)
  useEffect(() => {
    autoScrollRef.current = autoScroll
  })
  useEffect(() => {
    const { status, start, pause } = autoScrollRef.current
    if (continueAt.current === number) {
      continueAt.current = null
      start()
    } else if (status === 'running' && !navState?.stream) {
      pause()
    }
  }, [location.key, number, navState])

  // Đoạn đang đọc luôn ở giữa màn hình
  useEffect(() => {
    if (speech.status !== 'playing' || speech.chapter === null) return
    paragraphElement(speech.chapter, speech.paragraph)?.scrollIntoView({
      block: 'center',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [speech.status, speech.chapter, speech.paragraph, reducedMotion, chapter])

  usePrefetchChapters(chapter)
  useChapterKeys(slug, chapter?.prev?.number, chapter?.next?.number)
  useRecordChapterView(slug, chapter ? number : undefined)
  const resumed = useReadingTracker(chapter)

  if (isPending) return <ReaderSkeleton />
  if (isError)
    return error instanceof ChapterNotSavedError ? (
      <div className="px-4 py-32">
        <NotSavedNotice number={number} onRetry={() => void refetch()} />
      </div>
    ) : (
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
        <Seo title={`Không tìm thấy chương | ${SITE_NAME}`} noindex />
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
  const autoScrolling = autoScroll.status !== 'off'
  // Nghe truyện và tự động cuộn không chạy cùng lúc: bật cái này thì tắt cái kia
  const listen = speech.supported
    ? {
        active: listening,
        onClick: () => {
          if (speech.status === 'playing') speech.pause()
          else if (speech.status === 'paused') speech.resume()
          else {
            autoScroll.stop()
            speech.start(number, firstVisibleParagraph(number))
          }
        },
      }
    : undefined
  const autoScrollButton = {
    active: autoScrolling,
    onClick: () => {
      if (autoScroll.status === 'running') autoScroll.pause()
      else if (autoScroll.status === 'paused') autoScroll.resume()
      else {
        // Bắt đầu tự cuộn thì ẩn thanh công cụ để đọc; chạm vào chữ để hiện lại
        speech.stop()
        autoScroll.start()
        setToolbarVisible(false)
      }
    },
  }
  const next = chapter.next

  return (
    <>
      <Seo {...chapterSeo({ ...chapter.story, authorName: chapter.story.author.name }, chapter)} />
      {chapter.prev && <link rel="prev" href={paths.chapter(slug, chapter.prev.number)} />}
      {chapter.next && <link rel="next" href={paths.chapter(slug, chapter.next.number)} />}

      <ReadingProgress chapter={number} />
      <ReaderToolbar
        chapter={chapter}
        visible={toolbarVisible}
        open={open}
        setOpen={setOpen}
        listen={listen}
        autoScroll={autoScrollButton}
      />
      {resumed && <ResumeNotice key={location.key} chapter={number} />}

      <main
        id="chapter-content"
        className={cn(
          'mx-auto px-5 pt-24 pb-20 sm:px-8 sm:pt-28',
          (listening || autoScrolling) && 'pb-36',
        )}
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
      {autoScrolling && (
        <AutoScrollBar
          autoScroll={autoScroll}
          chapter={number}
          // Cuộn liên tục thì chương sau tự nối vào, không cần nút sang chương
          next={continuous ? null : (next?.number ?? null)}
          onNext={() => {
            if (!next) return
            continueAt.current = next.number
            navigate(paths.chapter(slug, next.number))
          }}
        />
      )}
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
