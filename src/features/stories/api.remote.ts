// Truyện đọc từ Supabase. Thẻ truyện lấy từ view story_cards (cards.remote.ts); tìm kiếm, xếp hạng và
// truyện liên quan tính bằng RPC. Danh sách công khai chỉ gồm truyện đã xuất bản có ≥ 1 chương.
import { unwrap } from '@/lib/dbError'
import { loadPage } from '@/lib/dbPage'
import { paginate } from '@/lib/pagination'
import { slugify } from '@/lib/slugify'
import { db } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Page } from '@/types/page'
import type { Genre, Story } from '@/types/story'
import {
  ownerIdFromAuthorSlug,
  publicStoryCards,
  type StoryCardRow,
  storiesByIds,
  storyBySlug,
  toStory,
} from './cards.remote'
import {
  BROWSE_PER_PAGE,
  type BrowseFilters,
  RANKING_LIMIT,
  type RankedStory,
  type RankingCriterion,
  type RankingPeriod,
  SEARCH_PER_PAGE,
  type SearchResult,
  type StorySort,
} from './shared'

/** Số truyện khi chưa ai chọn tay (curated_stories trống): bằng danh sách của bản giả */
const FEATURED_COUNT = 4
const EDITOR_PICK_COUNT = 8

/** Slug thể loại luôn có dạng này (ràng buộc ở DB); giá trị khác trên URL không khớp truyện nào */
const GENRE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const isPublic = (s: Story) => s.visibility === 'published' && s.chapterCount > 0

// ── Trang chủ ───────────────────────────────────────────────────────────

/** Truyện chọn tay (sửa qua Dashboard) theo position; bỏ truyện không còn công khai */
async function curated(list: 'featured' | 'editor_pick'): Promise<Story[]> {
  const rows = unwrap(
    await db()
      .from('curated_stories')
      .select('story_id')
      .eq('list', list)
      .order('position')
      .order('story_id'),
  )
  const stories = await storiesByIds(rows.map((r) => r.story_id))
  return stories.filter(isPublic)
}

export async function getFeaturedStories(): Promise<Story[]> {
  const picked = await curated('featured')
  if (picked.length) return picked
  // Chưa chọn tay: truyện đọc nhiều nhất, rồi mới cập nhật
  const rows = unwrap(
    await publicStoryCards()
      .order('view_count', { ascending: false })
      .order('updated_at', { ascending: false })
      .order('id')
      .limit(FEATURED_COUNT),
  )
  return rows.map(toStory)
}

export async function getEditorPicks(): Promise<Story[]> {
  const picked = await curated('editor_pick')
  if (picked.length) return picked
  // Chưa chọn tay: khối "Truyện đề cử" trên trang chủ không có trạng thái trống, nên lấy truyện
  // điểm cao nhất, rồi truyện mới đăng
  const rows = unwrap(
    await publicStoryCards()
      .order('rating_avg', { ascending: false })
      .order('rating_count', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .limit(EDITOR_PICK_COUNT),
  )
  return rows.map(toStory)
}

/** Top lượt đọc 7 ngày (dùng chung số liệu với bảng xếp hạng) */
export const getTrendingWeekly = (limit = 10) => getRanking({ by: 'views', period: 'week', limit })

export async function getLatestUpdated(limit = 12): Promise<Story[]> {
  const rows = unwrap(
    await publicStoryCards().order('updated_at', { ascending: false }).order('id').limit(limit),
  )
  return rows.map(toStory)
}

export async function getNewReleases(limit = 6): Promise<Story[]> {
  const rows = unwrap(
    await publicStoryCards().order('created_at', { ascending: false }).order('id').limit(limit),
  )
  return rows.map(toStory)
}

// ── Chi tiết truyện ─────────────────────────────────────────────────────

/** Truyện công khai, hoặc truyện nháp nếu người xem là tác giả (RLS cho chủ truyện thấy bản nháp) */
export async function getStory(slug: string): Promise<Story | null> {
  return storyBySlug(slug)
}

/** Truyện công khai khác của cùng tác giả, mới cập nhật trước */
export async function getStoriesByAuthor(authorSlug: string, excludeSlug?: string) {
  const ownerId = ownerIdFromAuthorSlug(authorSlug)
  if (!ownerId) return []
  let query = publicStoryCards().eq('owner_id', ownerId)
  if (excludeSlug) query = query.neq('slug', excludeSlug)
  const rows = unwrap(await query.order('updated_at', { ascending: false }).order('id'))
  return rows.map(toStory)
}

/** Truyện liên quan: nhiều thể loại trùng nhất, rồi nhiều lượt đọc nhất (bỏ truyện cùng tác giả) */
export async function getRelatedStories(slug: string, limit = 6): Promise<Story[]> {
  const rows = unwrap(await db().rpc('related_stories', { p_slug: slug, p_limit: limit }))
  return storiesByIds(rows.map((r) => r.story_id))
}

// ── Danh sách có bộ lọc (/list/:type, /genres/:slug) ──────────────

/** Cột sắp xếp (giảm dần); cột sau để phân định khi cột trước bằng nhau */
const sortColumns: Record<StorySort, (keyof StoryCardRow & string)[]> = {
  updated: ['updated_at'],
  views: ['view_count'],
  rating: ['rating_avg', 'rating_count'],
  newest: ['created_at'],
}

export async function browseStories({
  status,
  genre,
  length,
  sort = 'updated',
  page = 1,
}: BrowseFilters = {}): Promise<Page<Story>> {
  if (genre && !GENRE_SLUG.test(genre)) return paginate<Story>([], page, BROWSE_PER_PAGE)
  const result = await loadPage(page, BROWSE_PER_PAGE, (from, to) => {
    let query = publicStoryCards({ count: 'exact' })
    if (status) query = query.eq('status', status)
    if (genre) query = query.contains('genre_slugs', [genre])
    // Độ dài theo số chương đã xuất bản: ngắn < 50, vừa 50–200, dài > 200
    if (length === 'short') query = query.lt('chapter_count', 50)
    if (length === 'medium') query = query.gte('chapter_count', 50).lte('chapter_count', 200)
    if (length === 'long') query = query.gt('chapter_count', 200)
    for (const column of sortColumns[sort]) query = query.order(column, { ascending: false })
    return query.order('id').range(from, to)
  })
  return { ...result, items: result.items.map(toStory) }
}

// ── Tìm kiếm ────────────────────────────────────────────────────────────

/** RPC search_stories chấm điểm giống matchScore: điểm cao trước, rồi đọc nhiều */
const searchQuery = (query: string, options?: { count: 'exact' }) =>
  db()
    .rpc('search_stories', { p_query: query }, options)
    .order('score', { ascending: false })
    .order('view_count', { ascending: false })
    .order('story_id')

type GenreCardRow = Database['public']['Views']['genre_cards']['Row']

function toGenre(
  row: Pick<GenreCardRow, 'slug' | 'name' | 'description' | 'created_by' | 'created_by_name'>,
) {
  const genre: Genre = { slug: row.slug!, name: row.name! }
  if (row.description) genre.description = row.description
  if (row.created_by) {
    genre.createdBy = { id: row.created_by, displayName: row.created_by_name ?? '' }
  }
  return genre
}

/** Thể loại có slug chứa từ khóa (q đã slugify nên không có ký tự đặc biệt của LIKE) */
async function genresMatching(q: string): Promise<Genre[]> {
  const rows = unwrap(
    await db()
      .from('genre_cards')
      .select('slug, name, description, created_by, created_by_name')
      .ilike('slug', `%${q}%`)
      .order('created_at')
      .order('slug'),
  )
  return rows.map(toGenre)
}

/** Tìm theo tên truyện hoặc tác giả, không phân biệt dấu; kèm các thể loại có tên khớp */
export async function searchStories(query: string, page = 1): Promise<SearchResult> {
  const q = slugify(query)
  if (!q) return { ...paginate<Story>([], page, SEARCH_PER_PAGE), genres: [] }
  const [result, genres] = await Promise.all([
    loadPage(page, SEARCH_PER_PAGE, (from, to) =>
      searchQuery(query, { count: 'exact' }).range(from, to),
    ),
    genresMatching(q),
  ])
  const items = await storiesByIds(result.items.map((r) => r.story_id))
  return { ...result, items, genres }
}

/** Gợi ý nhanh khi gõ ở ô tìm kiếm */
export async function getSearchSuggestions(query: string, limit = 5): Promise<Story[]> {
  if (!slugify(query)) return []
  const rows = unwrap(await searchQuery(query).limit(limit))
  return storiesByIds(rows.map((r) => r.story_id))
}

// ── Bảng xếp hạng ───────────────────────────────────────────────────────

/**
 * RPC story_ranking: lượt đọc trong kỳ (7/30 ngày theo giờ Việt Nam, hoặc tổng), người theo dõi,
 * hoặc điểm (xếp theo điểm có trọng số, value là điểm trung bình thật). Chỉ số liệu thật.
 */
export async function getRanking({
  by = 'views',
  period = 'week',
  limit = RANKING_LIMIT,
}: {
  by?: RankingCriterion
  period?: RankingPeriod
  limit?: number
} = {}): Promise<RankedStory[]> {
  const rows = unwrap(
    await db().rpc('story_ranking', { p_by: by, p_period: period, p_limit: limit }),
  )
  const values = new Map(rows.map((r) => [r.story_id, Number(r.value)]))
  const stories = await storiesByIds(rows.map((r) => r.story_id))
  return stories.map((story) => ({ story, value: values.get(story.id) ?? 0 }))
}
