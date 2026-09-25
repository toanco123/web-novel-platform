import type { User } from './user'

export type Comment = {
  id: string
  storySlug: string
  /** null: bình luận của cả truyện; có số: bình luận của chương đó */
  chapterNumber: number | null
  user: Pick<User, 'id' | 'displayName' | 'avatarUrl'>
  content: string
  createdAt: string
}

export type Score = 1 | 2 | 3 | 4 | 5

export type RatingSummary = {
  average: number
  count: number
  distribution: Record<Score, number>
}
