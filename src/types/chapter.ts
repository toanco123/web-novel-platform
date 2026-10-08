import type { Author, NextChapter, StoryStatus, StoryVisibility } from './story'

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
  /** Giờ hẹn tự xuất bản (chỉ chương nháp); null: không hẹn */
  scheduledAt: string | null
}

export type ChapterNeighbor = { number: number; title: string }

/** Một chương cho trang đọc: nội dung + thông tin truyện + chương trước/sau */
export type ChapterContent = {
  story: {
    slug: string
    title: string
    author: Author
    status: StoryStatus
    chapterCount: number
    /** Ảnh bìa (tab "Đã lưu" hiện bìa của truyện đã lưu trên máy) */
    coverUrl: string | null
    /** Chủ truyện đọc được cả truyện chưa công khai; loại này không lưu vào kho đọc offline */
    visibility: StoryVisibility
    /** Chương hẹn giờ sớm nhất (cuối chương mới nhất báo "Chương N ra lúc …") */
    nextChapter: NextChapter | null
  }
  number: number
  title: string
  /** HTML rút gọn của trình soạn hoặc văn bản thuần kiểu cũ: đọc qua `parseContent` (`features/chapters/richText`) */
  content: string
  publishedAt: string
  prev: ChapterNeighbor | null
  next: ChapterNeighbor | null
}
