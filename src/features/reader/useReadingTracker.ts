import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useSaveReadingProgress } from '@/features/library/hooks'
import { markReadSaved } from '@/features/offline/readChapter'
import { readResumeState } from '@/features/library/resume'
import type { ChapterContent } from '@/types/chapter'
import { chapterElement, progressOf, scrollToProgress } from './progress'

/** Lưu vị trí trên máy (IndexedDB, rẻ) tối đa mỗi giây khi đang cuộn */
const LOCAL_SAVE_MS = 1000
/** Gửi vị trí lên máy chủ thưa hơn; rời chương, rời trang, ẩn tab thì gửi ngay */
const SERVER_SAVE_MS = 15_000
/** Dưới mức này coi như mới mở đầu chương, không cần cuộn tới */
const MIN_RESUME = 0.03

/**
 * Lịch sử đọc cho trang đọc: ghi chương khi mở, lưu vị trí cuộn (trên máy tối đa mỗi giây, lên máy
 * chủ tối đa mỗi 15 giây khi đang cuộn, và ngay khi rời chương/trang hoặc ẩn tab), mở lại chỗ đọc
 * dở khi tới từ link "Đọc tiếp".
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
    void markReadSaved(slug, number).catch(() => {})
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
    let localTimer: ReturnType<typeof setTimeout> | undefined
    let serverTimer: ReturnType<typeof setTimeout> | undefined
    let localDirty = false
    let serverDirty = false
    // Vị trí đo lần cuộn gần nhất: khi rời chương, cleanup chạy sau khi chương đã bị gỡ khỏi trang
    // (không đo được nữa) nên lưu bằng số này
    let last: number | null = null
    const position = () => {
      const el = chapterElement(number)
      if (el) last = progressOf(el)
      return last
    }
    const flushLocal = () => {
      clearTimeout(localTimer)
      localTimer = undefined
      if (!localDirty) return
      localDirty = false
      const progress = position()
      // Bản lưu trên máy nhớ chỗ đọc để "Đọc tiếp" ở tab Đã lưu (cả khi offline)
      if (progress !== null) void markReadSaved(slug, number, progress).catch(() => {})
    }
    const flushServer = () => {
      clearTimeout(serverTimer)
      serverTimer = undefined
      if (!serverDirty) return
      serverDirty = false
      const progress = position()
      if (progress !== null) save({ slug, chapter: number, chapterTitle: title, progress })
    }
    const flush = () => {
      flushLocal()
      flushServer()
    }
    const onScroll = () => {
      position()
      localDirty = serverDirty = true
      localTimer ??= setTimeout(flushLocal, LOCAL_SAVE_MS)
      serverTimer ??= setTimeout(flushServer, SERVER_SAVE_MS)
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      // Rời chương (chuyển chương, rời trang đọc): lưu vị trí cuối cùng
      flush()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [save, slug, number, title])

  return resuming
}
