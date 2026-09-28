// Phần dùng chung của hai backend tủ truyện (api.mock.ts, api.remote.ts)
import type { ReadingProgress } from '@/types/library'

/** Số truyện tối đa trong lịch sử đọc */
export const HISTORY_LIMIT = 100

/** Chỗ đang đọc: gửi khi mở chương (progress bỏ trống) và khi cuộn */
export type ProgressInput = {
  slug: string
  chapter: number
  chapterTitle: string
  progress?: number
}

/** Gộp hai lịch sử: mỗi truyện giữ lần đọc mới nhất, xếp mới nhất trước */
export function mergeHistory(a: ReadingProgress[], b: ReadingProgress[]) {
  const bySlug = new Map<string, ReadingProgress>()
  for (const entry of [...a, ...b]) {
    const current = bySlug.get(entry.slug)
    if (!current || entry.readAt > current.readAt) bySlug.set(entry.slug, entry)
  }
  return [...bySlug.values()]
    .sort((x, y) => y.readAt.localeCompare(x.readAt))
    .slice(0, HISTORY_LIMIT)
}

/**
 * Ghi chỗ đang đọc vào lịch sử lưu trên máy: truyện đó lên đầu, mỗi truyện một dòng.
 * progress bỏ trống thì giữ vị trí cũ nếu vẫn chương đó.
 */
export function addToHistory(history: ReadingProgress[], input: ProgressInput) {
  const same = history.find((p) => p.slug === input.slug && p.chapter === input.chapter)
  const entry: ReadingProgress = {
    slug: input.slug,
    chapter: input.chapter,
    chapterTitle: input.chapterTitle,
    progress: Math.min(1, Math.max(0, input.progress ?? same?.progress ?? 0)),
    readAt: new Date().toISOString(),
  }
  return {
    entry,
    history: [entry, ...history.filter((p) => p.slug !== input.slug)].slice(0, HISTORY_LIMIT),
  }
}
