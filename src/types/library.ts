import type { Story } from './story'

/** Chỗ đọc dở của một truyện (mỗi truyện một dòng trong lịch sử) */
export type ReadingProgress = {
  slug: string
  chapter: number
  chapterTitle: string
  /** Tỉ lệ đã cuộn trong chương, 0–1 */
  progress: number
  readAt: string
}

export type HistoryItem = { story: Story; progress: ReadingProgress }

export type LibraryItem = {
  story: Story
  followedAt: string
  /** Số chương xuất bản sau lần cuối người dùng thấy/đọc truyện */
  newChapters: number
  progress: ReadingProgress | null
}
