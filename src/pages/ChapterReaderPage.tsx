import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useChapter, usePrefetchChapter } from '@/features/chapters/hooks'
import { ChapterArticle } from '@/features/reader/components/ChapterArticle'
import { ChapterEnd } from '@/features/reader/components/ChapterEnd'
import { ChapterNav } from '@/features/reader/components/ChapterNav'
import { ReaderToolbar, type ReaderPanel } from '@/features/reader/components/ReaderToolbar'
import { ReadingProgress } from '@/features/reader/components/ReadingProgress'
import { widths } from '@/features/reader/readerOptions'
import { useAutoHideToolbar } from '@/features/reader/useAutoHideToolbar'
import { useChapterKeys } from '@/features/reader/useChapterKeys'
import { useReaderSettings } from '@/features/reader/useReaderSettings'
import { paths } from '@/lib/routes'

// Router không hỗ trợ tham số nằm giữa đoạn URL ("chuong-:number") nên tự tách ở đây
const parseChapterSegment = (segment: string) => {
  const match = /^chuong-(\d{1,6})$/.exec(segment)
  return match ? Number(match[1]) : null
}

export default function ChapterReaderPage() {
  const { slug = '', chapter = '' } = useParams()
  const number = parseChapterSegment(chapter)
  if (number === null) return <NotFound message="Đường dẫn chương không hợp lệ." />
  return <Reader slug={slug} number={number} />
}

function Reader({ slug, number }: { slug: string; number: number }) {
  const { data: chapter, isPending, isError, refetch } = useChapter(slug, number)
  const [toolbarVisible, setToolbarVisible] = useAutoHideToolbar()
  // Gắn bảng đang mở với số chương: chuyển sang chương khác là bảng tự đóng
  const [panel, setPanel] = useState<{ name: ReaderPanel; chapter: number } | null>(null)
  const open = panel?.chapter === number ? panel.name : null
  const setOpen = (name: ReaderPanel | null) => setPanel(name ? { name, chapter: number } : null)
  const width = useReaderSettings((s) => s.width)

  usePrefetchChapter(slug, chapter?.next?.number)
  useChapterKeys(slug, chapter?.prev?.number, chapter?.next?.number)

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

  return (
    <>
      <title>{`Chương ${chapter.number}: ${chapter.title} - ${chapter.story.title} | ${SITE_NAME}`}</title>
      <meta
        name="description"
        content={`Đọc chương ${chapter.number} "${chapter.title}" của truyện ${chapter.story.title} (${chapter.story.author.name}).`}
      />
      {chapter.prev && <link rel="prev" href={paths.chapter(slug, chapter.prev.number)} />}
      {chapter.next && <link rel="next" href={paths.chapter(slug, chapter.next.number)} />}

      <ReadingProgress key={number} />
      <ReaderToolbar chapter={chapter} visible={toolbarVisible} open={open} setOpen={setOpen} />

      <main
        id="chapter-content"
        className="mx-auto px-5 pt-24 pb-20 sm:px-8 sm:pt-28"
        style={{ maxWidth: `calc(${widths.find((w) => w.value === width)?.maxWidth} + 4rem)` }}
      >
        <ChapterArticle
          chapter={chapter}
          nav={<ChapterNav chapter={chapter} onOpenIndex={openIndex} label="Chuyển chương (đầu)" />}
          onTap={() => setToolbarVisible((v) => !v)}
        />
        <div className="mt-16 space-y-10">
          <ChapterEnd chapter={chapter} />
          <ChapterNav
            chapter={chapter}
            onOpenIndex={openIndex}
            label="Chuyển chương (cuối)"
            emphasizeNext={!chapter.next}
          />
        </div>
      </main>
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
