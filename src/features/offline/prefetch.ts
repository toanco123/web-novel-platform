// Tải trước vài chương kế tiếp vào kho trên máy khi đang có mạng, để mất mạng giữa chừng vẫn đọc
// tiếp được. Không tải khi máy bật tiết kiệm dữ liệu.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getChapterRange } from '@/features/chapters/api'
import { chapterKeys } from '@/features/chapters/hooks'
import type { ChapterContent } from '@/types/chapter'
import { isSavable, offlineAvailable, saveChapters, walkSaved } from './store'

/** Số chương tải trước sau chương đang đọc */
export const PREFETCH_COUNT = 5

const saveData = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

/** Chạy `task` khi trình duyệt rảnh (sau khi trang đọc đã hiện); trả hàm hủy */
function whenIdle(task: () => void) {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(task, { timeout: 3000 })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(task, 300)
  return () => clearTimeout(id)
}

/** Tải các chương còn thiếu trong PREFETCH_COUNT chương tính từ chương `from`; trả chương vừa tải */
export async function prefetchFrom(slug: string, from: number): Promise<ChapterContent[]> {
  if (!navigator.onLine || saveData() || !(await offlineAvailable())) return []
  const { saved, missing } = await walkSaved(slug, from, PREFETCH_COUNT)
  if (missing === null) return []
  const chapters = await getChapterRange(slug, missing, PREFETCH_COUNT - saved.length)
  await saveChapters(chapters)
  return chapters
}

/**
 * Trang đọc: mở chương xong thì tải trước các chương sau; chương ngay sau vào luôn cache. Truyện
 * chưa công khai không lưu vào kho nên không tải trước.
 */
export function usePrefetchChapters(chapter: ChapterContent | null | undefined) {
  const queryClient = useQueryClient()
  const slug = chapter && isSavable(chapter) ? chapter.story.slug : undefined
  const next = chapter?.next?.number
  useEffect(() => {
    if (slug === undefined || next === undefined) return
    return whenIdle(() => {
      prefetchFrom(slug, next)
        .then((chapters) => {
          const first = chapters.find((c) => c.number === next)
          if (first) queryClient.setQueryData(chapterKeys.detail(slug, next), first)
        })
        .catch(() => {
          // Mạng yếu, bộ nhớ đầy: bỏ qua, lần mở chương sau thử lại
        })
    })
  }, [queryClient, slug, next])
}
