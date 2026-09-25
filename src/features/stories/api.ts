// Nơi DUY NHẤT lấy dữ liệu truyện. Giai đoạn UI đọc từ danh mục giả (truyện có sẵn + truyện người dùng).
import { getSession } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { catalog, findStory } from '@/mocks/catalog'
import { editorPickSlugs, featuredSlugs, stories as seedStories } from '@/mocks/stories'
import type { Story } from '@/types/story'

const bySlugs = (slugs: string[]) => slugs.map((s) => seedStories.find((x) => x.slug === s)!)
const desc =
  <T>(pick: (x: T) => number) =>
  (a: T, b: T) =>
    pick(b) - pick(a)
/** Danh sách công khai: chỉ truyện đã xuất bản và có ít nhất 1 chương */
const publicStories = () => catalog().filter((s) => s.chapterCount > 0)

export async function getFeaturedStories(): Promise<Story[]> {
  await delay()
  return bySlugs(featuredSlugs)
}

export async function getEditorPicks(): Promise<Story[]> {
  await delay()
  return bySlugs(editorPickSlugs)
}

/** Top theo lượt xem (mock: lượt xem tổng; thật: lượt xem 7 ngày) */
export async function getTrendingWeekly(limit = 10): Promise<Story[]> {
  await delay()
  return publicStories()
    .sort(desc((s) => s.viewCount))
    .slice(0, limit)
}

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
  return findStory(slug, viewer?.id ?? null)
}

export async function getStoriesByGenre(genreSlug: string): Promise<Story[]> {
  await delay()
  return publicStories()
    .filter((s) => s.genres.some((g) => g.slug === genreSlug))
    .sort(desc((s) => Date.parse(s.updatedAt)))
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
