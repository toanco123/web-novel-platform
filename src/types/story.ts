export type Genre = {
  slug: string
  name: string
  description?: string
  /** null/undefined: thể loại có sẵn của hệ thống */
  createdBy?: { id: string; displayName: string } | null
}

export type Author = {
  slug: string
  name: string
}

export type StoryStatus = 'ongoing' | 'completed'

export type StoryVisibility = 'draft' | 'published'

export type Story = {
  id: string
  slug: string
  title: string
  author: Author
  genres: Genre[]
  status: StoryStatus
  description: string
  coverUrl: string | null
  chapterCount: number
  viewCount: number
  ratingAvg: number
  ratingCount: number
  /** null khi truyện chưa có chương nào được xuất bản */
  firstChapterNumber: number | null
  /** null khi truyện chưa có chương nào được xuất bản */
  latestChapter: { number: number; title: string } | null
  /** null: truyện có sẵn của hệ thống; có giá trị: truyện do người dùng đăng */
  ownerId: string | null
  visibility: StoryVisibility
  createdAt: string
  updatedAt: string
}
