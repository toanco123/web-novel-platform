import type { User } from './user'

export type Comment = {
  id: string
  storySlug: string
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
