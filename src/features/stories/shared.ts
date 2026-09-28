// Phần dùng chung của hai backend truyện (api.mock.ts, api.remote.ts)
import { slugify } from '@/lib/slugify'
import type { Page } from '@/types/page'
import type { Genre, Story, StoryStatus } from '@/types/story'

// ── Danh sách có bộ lọc (/danh-sach/:loai, /the-loai/:slug) ──────────────

export type StoryLength = 'short' | 'medium' | 'long'
export type StorySort = 'updated' | 'views' | 'rating' | 'newest'

export type BrowseFilters = {
  status?: StoryStatus
  genre?: string
  length?: StoryLength
  sort?: StorySort
  page?: number
}

export const BROWSE_PER_PAGE = 24

// ── Tìm kiếm ────────────────────────────────────────────────────────────

export const SEARCH_PER_PAGE = 20

/**
 * Độ khớp của truyện với từ khóa (đã slugify, không dấu). 0 = không khớp.
 * Tên bắt đầu bằng từ khóa > tên chứa từ khóa > tên chứa đủ các từ > tác giả khớp.
 */
export function matchScore(story: Pick<Story, 'title' | 'author'>, query: string) {
  const q = slugify(query)
  if (!q) return 0
  const title = slugify(story.title)
  if (title.startsWith(q)) return 4
  if (title.includes(q)) return 3
  const words = q.split('-')
  if (words.every((w) => title.includes(w))) return 2
  return slugify(story.author.name).includes(q) ? 1 : 0
}

export type SearchResult = Page<Story> & { genres: Genre[] }

// ── Bảng xếp hạng ───────────────────────────────────────────────────────

export type RankingCriterion = 'views' | 'rating' | 'follows'
export type RankingPeriod = 'week' | 'month' | 'all'
export type RankedStory = { story: Story; value: number }

export const RANKING_LIMIT = 50
