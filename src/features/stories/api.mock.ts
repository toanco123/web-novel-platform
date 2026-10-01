// Truyện đọc từ danh mục giả (truyện có sẵn + truyện người dùng trong localStorage): dùng cho test tự
// động và khi chạy không có Supabase (xem api.ts). Bản thật: api.remote.ts.
import { getSession } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { paginate } from '@/lib/pagination'
import { seededRandom } from '@/lib/seededRandom'
import { slugify } from '@/lib/slugify'
import { followerCount, loadViews, recentViews, type ViewStats } from '@/mocks/activity'
import { allGenres, catalog, findStory } from '@/mocks/catalog'
import { loadCurated } from '@/mocks/curated'
import { editorPickSlugs, featuredSlugs, stories as seedStories } from '@/mocks/stories'
import type { Page } from '@/types/page'
import type { CuratedList, Story } from '@/types/story'
import {
  BROWSE_PER_PAGE,
  type BrowseFilters,
  matchScore,
  RANKING_LIMIT,
  type RankedStory,
  type RankingCriterion,
  type RankingPeriod,
  SEARCH_PER_PAGE,
  type SearchResult,
  type StoryLength,
  type StorySort,
} from './shared'

const bySlugs = (slugs: string[]) => slugs.map((s) => seedStories.find((x) => x.slug === s)!)
const desc =
  <T>(pick: (x: T) => number) =>
  (a: T, b: T) =>
    pick(b) - pick(a)
/** Danh sách công khai: chỉ truyện đã xuất bản và có ít nhất 1 chương */
const publicStories = () => catalog().filter((s) => s.chapterCount > 0)

/** Truyện quản trị viên chọn tay, theo thứ tự đã xếp; bỏ truyện không còn công khai */
function curated(list: CuratedList): Story[] {
  const stories = new Map(publicStories().map((s) => [s.id, s]))
  return loadCurated(list).flatMap((id) => stories.get(id) ?? [])
}

export async function getFeaturedStories(): Promise<Story[]> {
  await delay()
  const picked = curated('featured')
  // Chưa chọn tay: danh sách có sẵn của bản giả
  return picked.length ? picked : bySlugs(featuredSlugs)
}

export async function getEditorPicks(): Promise<Story[]> {
  await delay()
  const picked = curated('editor_pick')
  return picked.length ? picked : bySlugs(editorPickSlugs)
}

/** Top lượt đọc 7 ngày (dùng chung số liệu với bảng xếp hạng) */
export const getTrendingWeekly = (limit = 10) => getRanking({ by: 'views', period: 'week', limit })

export async function getLatestUpdated(limit = 12): Promise<Story[]> {
  await delay()
  return publicStories()
    .sort(desc((s) => Date.parse(s.updatedAt)))
    .slice(0, limit)
}

export async function getNewReleases(limit = 6): Promise<Story[]> {
  await delay()
  return publicStories()
    .sort(desc((s) => Date.parse(s.createdAt)))
    .slice(0, limit)
}

/** Truyện công khai, hoặc truyện nháp nếu người xem là tác giả (xem trước) */
export async function getStory(slug: string): Promise<Story | null> {
  await delay()
  const viewer = await getSession()
  return findStory(slug, viewer?.id ?? null, viewer?.isAdmin)
}

export async function getStoriesByAuthor(authorSlug: string, excludeSlug?: string) {
  await delay()
  return publicStories().filter((s) => s.author.slug === authorSlug && s.slug !== excludeSlug)
}

/** Truyện liên quan: nhiều thể loại trùng nhất, rồi nhiều lượt xem nhất */
export async function getRelatedStories(slug: string, limit = 6): Promise<Story[]> {
  await delay()
  const all = publicStories()
  const story = catalog().find((s) => s.slug === slug)
  if (!story) return []
  const genreSlugs = new Set(story.genres.map((g) => g.slug))
  const overlap = (s: Story) => s.genres.filter((g) => genreSlugs.has(g.slug)).length
  return all
    .filter((s) => s.slug !== slug && s.author.slug !== story.author.slug && overlap(s) > 0)
    .sort((a, b) => overlap(b) - overlap(a) || b.viewCount - a.viewCount)
    .slice(0, limit)
}

// ── Danh sách có bộ lọc (/list/:type, /genres/:slug) ──────────────

const lengthMatches: Record<StoryLength, (chapters: number) => boolean> = {
  short: (n) => n < 50,
  medium: (n) => n >= 50 && n <= 200,
  long: (n) => n > 200,
}

const sorters: Record<StorySort, (a: Story, b: Story) => number> = {
  updated: desc((s) => Date.parse(s.updatedAt)),
  views: desc((s) => s.viewCount),
  rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount,
  newest: desc((s) => Date.parse(s.createdAt)),
}

export async function browseStories({
  status,
  genre,
  length,
  sort = 'updated',
  page = 1,
}: BrowseFilters = {}): Promise<Page<Story>> {
  await delay()
  const matched = publicStories().filter(
    (s) =>
      (!status || s.status === status) &&
      (!genre || s.genres.some((g) => g.slug === genre)) &&
      (!length || lengthMatches[length](s.chapterCount)),
  )
  return paginate(matched.sort(sorters[sort]), page, BROWSE_PER_PAGE)
}

// ── Tìm kiếm ────────────────────────────────────────────────────────────

function search(query: string) {
  return publicStories()
    .map((story) => ({ story, score: matchScore(story, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.story.viewCount - a.story.viewCount)
    .map((r) => r.story)
}

/** Tìm theo tên truyện hoặc tác giả, không phân biệt dấu; kèm các thể loại có tên khớp */
export async function searchStories(query: string, page = 1): Promise<SearchResult> {
  await delay()
  const q = slugify(query)
  const genres = q ? allGenres().filter((g) => g.slug.includes(q)) : []
  return { ...paginate(q ? search(query) : [], page, SEARCH_PER_PAGE), genres }
}

/** Gợi ý nhanh khi gõ ở ô tìm kiếm */
export async function getSearchSuggestions(query: string, limit = 5): Promise<Story[]> {
  await delay(120)
  return search(query).slice(0, limit)
}

// ── Bảng xếp hạng ───────────────────────────────────────────────────────

/** Số lượt chấm "ảo" khi xếp theo điểm, để truyện ít lượt chấm không lên đầu */
const RATING_PRIOR = 50

/**
 * Lượt đọc trong kỳ. Truyện có sẵn: số giả cố định theo slug (truyện đang ra, mới cập nhật
 * được nhân đôi) cộng lượt đọc thật đã ghi; truyện người dùng đăng: chỉ lượt đọc thật.
 */
function periodViews(story: Story, period: RankingPeriod, stats: ViewStats | undefined) {
  if (period === 'all') return story.viewCount
  const days = period === 'week' ? 7 : 30
  const recorded = recentViews(stats, days)
  if (story.ownerId) return recorded
  const rand = seededRandom(`views:${story.slug}`)
  const hoursSinceUpdate = (Date.now() - Date.parse(story.updatedAt)) / 3_600_000
  const boost = story.status === 'ongoing' && hoursSinceUpdate < 72 ? 2 : 1
  const week = Math.round(story.viewCount * (0.004 + rand() * 0.03) * boost)
  const month = Math.round(week * (3 + rand() * 1.5))
  return (period === 'week' ? week : month) + recorded
}

/** Người theo dõi: số giả cố định theo slug cho truyện có sẵn + lượt theo dõi thật */
function followers(story: Story) {
  const base = story.ownerId
    ? 0
    : Math.round(story.viewCount * (0.01 + seededRandom(`follows:${story.slug}`)() * 0.04))
  return base + followerCount(story.slug)
}

export async function getRanking({
  by = 'views',
  period = 'week',
  limit = RANKING_LIMIT,
}: {
  by?: RankingCriterion
  period?: RankingPeriod
  limit?: number
} = {}): Promise<RankedStory[]> {
  await delay()
  const all = publicStories()

  if (by === 'rating') {
    const rated = all.filter((s) => s.ratingCount > 0)
    const mean = rated.reduce((sum, s) => sum + s.ratingAvg, 0) / Math.max(1, rated.length)
    const weighted = (s: Story) =>
      (s.ratingAvg * s.ratingCount + mean * RATING_PRIOR) / (s.ratingCount + RATING_PRIOR)
    return rated
      .sort((a, b) => weighted(b) - weighted(a))
      .slice(0, limit)
      .map((story) => ({ story, value: story.ratingAvg }))
  }

  const views = loadViews()
  const value = (s: Story) =>
    by === 'follows' ? followers(s) : periodViews(s, period, views[s.slug])
  return all
    .map((story) => ({ story, value: value(story) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}
