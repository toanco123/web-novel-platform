import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useSaveReadingProgress } from '@/features/library/hooks'
import { readResumeState } from '@/features/library/resume'
import type { ChapterContent } from '@/types/chapter'
import { chapterElement, progressOf, scrollToProgress } from './progress'

const SAVE_EVERY_MS = 1000
/** Dưới mức này coi như mới mở đầu chương, không cần cuộn tới */
const MIN_RESUME = 0.03

/**
 * Lịch sử đọc cho trang đọc: ghi chương khi mở, lưu vị trí cuộn (tối đa mỗi giây khi đang cuộn,
 * và khi rời chương/trang), mở lại chỗ đọc dở khi tới từ link "Đọc tiếp".
 * Trả về true nếu lần điều hướng này mở lại chỗ đọc dở.
 */
export function useReadingTracker(chapter: ChapterContent | null | undefined) {
  const { mutate: save } = useSaveReadingProgress()
  const location = useLocation()
  const slug = chapter?.story.slug
  const number = chapter?.number
  const title = chapter?.title
  const resume = readResumeState(location.state)

  // Mở chương: đưa truyện lên đầu lịch sử (cùng chương thì giữ vị trí cũ)
  useEffect(() => {
    if (slug === undefined || number === undefined || title === undefined) return
    save({ slug, chapter: number, chapterTitle: title })
  }, [save, slug, number, title])

  // Tới từ "Đọc tiếp": cuộn tới chỗ đã lưu, mỗi lần điều hướng một lần
  const resuming = number !== undefined && resume !== null && resume >= MIN_RESUME
  useEffect(() => {
    if (!resuming || number === undefined || resume === null) return
    const scroll = () => {
      const el = chapterElement(number)
      if (el) scrollToProgress(el, resume)
    }
    scroll()
    // Phông chữ đọc chỉ tải khi vào trang đọc; tải xong chữ dàn lại làm chương dài ra,
    // nên cuộn lại một lần cho đúng chỗ
    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) scroll()
    })
    return () => {
      cancelled = true
    }
  }, [location.key, resuming, number, resume])

  useEffect(() => {
    if (slug === undefined || number === undefined || title === undefined) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let dirty = false
    const flush = () => {
      clearTimeout(timer)
      timer = undefined
      if (!dirty) return
      dirty = false
      const el = chapterElement(number)
      if (el) save({ slug, chapter: number, chapterTitle: title, progress: progressOf(el) })
    }
    const onScroll = () => {
      dirty = true
      timer ??= setTimeout(flush, SAVE_EVERY_MS)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', flush)
    return () => {
      // Rời chương (chuyển chương, rời trang đọc): lưu vị trí cuối cùng
      flush()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', flush)
    }
  }, [save, slug, number, title])

  return resuming
}
