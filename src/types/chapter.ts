import type { Author, StoryStatus } from './story'

export type ChapterSummary = {
  number: number
  title: string
  createdAt: string
}

export type ChapterOrder = 'asc' | 'desc'

export type ChapterStatus = 'draft' | 'published'

/** Chương đầy đủ nội dung (truyện do người dùng đăng) */
export type Chapter = {
  id: string
  storyId: string
  number: number
  title: string
  content: string
  status: ChapterStatus
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type ChapterNeighbor = { number: number; title: string }

/** Một chương cho trang đọc: nội dung + thông tin truyện + chương trước/sau */
export type ChapterContent = {
  story: { slug: string; title: string; author: Author; status: StoryStatus; chapterCount: number }
  number: number
  title: string
  /** Văn bản thuần, các đoạn cách nhau bằng dòng trống */
  content: string
  publishedAt: string
  prev: ChapterNeighbor | null
  next: ChapterNeighbor | null
}
