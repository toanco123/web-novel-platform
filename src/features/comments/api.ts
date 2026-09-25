// Nơi DUY NHẤT xử lý bình luận và chấm điểm. Giai đoạn UI: bình luận mẫu + localStorage.
import { getProfiles, requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import {
  loadRatings,
  loadUserComments,
  ratingsOf,
  saveRatings,
  saveUserComments,
} from '@/mocks/activity'
import { findStory } from '@/mocks/catalog'
import { seedChapterComments, seedComments } from '@/mocks/comments'
import type { Comment, RatingSummary, Score } from '@/types/comment'

export const COMMENTS_PER_PAGE = 10

/**
 * Truyện có sẵn của hệ thống (chỉ truyện này có bình luận mẫu và điểm gốc); truyện người dùng
 * đăng thì null: điểm của nó đã tính từ lượt chấm thật, cộng điểm gốc nữa sẽ bị tính hai lần
 */
function seedStory(slug: string) {
  const story = findStory(slug)
  return story?.ownerId === null ? story : null
}

const seedCache = new Map<string, Comment[]>()
/** Bình luận mẫu của truyện (chapter = null) hoặc của một chương */
function seeded(slug: string, chapter: number | null) {
  const key = `${slug}#${chapter ?? ''}`
  if (!seedCache.has(key)) {
    const story = seedStory(slug)
    const valid = story && (chapter === null || (chapter >= 1 && chapter <= story.chapterCount))
    seedCache.set(
      key,
      !valid ? [] : chapter === null ? seedComments(story) : seedChapterComments(story, chapter),
    )
  }
  return seedCache.get(key)!
}

/** Bình luận của truyện (chapter = null, mặc định) hoặc của một chương, mới nhất trước */
export async function getComments(
  slug: string,
  { chapter = null, cursor = 0 }: { chapter?: number | null; cursor?: number } = {},
) {
  await delay()
  const own = loadUserComments().filter((c) => c.storySlug === slug && c.chapterNumber === chapter)
  const all = [...own, ...seeded(slug, chapter)].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
  const page = all.slice(cursor, cursor + COMMENTS_PER_PAGE)
  // Tên và ảnh lấy theo hồ sơ hiện tại (người dùng có thể đã đổi sau khi bình luận)
  const profiles = await getProfiles(page.map((c) => c.user.id))
  const items = page.map((c) => ({ ...c, user: profiles.get(c.user.id) ?? c.user }))
  const next = cursor + items.length
  return { items, total: all.length, nextCursor: next < all.length ? next : null }
}

export async function addComment(
  slug: string,
  content: string,
  chapter: number | null = null,
): Promise<Comment> {
  await delay(400)
  const user = await requireUser()
  const comment: Comment = {
    id: crypto.randomUUID(),
    storySlug: slug,
    chapterNumber: chapter,
    // Không chép ảnh đại diện (data URL) vào từng bình luận; khi đọc sẽ lấy theo hồ sơ
    user: { id: user.id, displayName: user.displayName, avatarUrl: null },
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }
  saveUserComments([comment, ...loadUserComments()])
  return comment
}

/** Chỉ xóa được bình luận của chính mình */
export async function deleteComment(id: string) {
  await delay(300)
  const user = await requireUser()
  saveUserComments(loadUserComments().filter((c) => !(c.id === id && c.user.id === user.id)))
}

/** Phân bố 5→1 sao suy ra từ điểm trung bình gốc (dữ liệu giả, chỉ để vẽ biểu đồ) */
function baseDistribution(average: number, count: number): Record<Score, number> {
  const weights = ([1, 2, 3, 4, 5] as Score[]).map((k) => Math.exp(-((k - average) ** 2) / 0.8))
  const sum = weights.reduce((a, b) => a + b, 0)
  const [d1, d2, d3, d4, d5] = weights.map((w) => Math.round((w / sum) * count))
  return { 1: d1, 2: d2, 3: d3, 4: d4, 5: d5 }
}

export async function getRatingSummary(slug: string): Promise<RatingSummary> {
  await delay()
  const story = seedStory(slug)
  const base = story
    ? { average: story.ratingAvg, count: story.ratingCount }
    : { average: 0, count: 0 }
  const distribution = baseDistribution(base.average, base.count)
  const extra = ratingsOf(slug)
  for (const score of extra) distribution[score]++
  const count = base.count + extra.length
  const total = base.average * base.count + extra.reduce((a, b) => a + b, 0)
  return { average: count ? total / count : 0, count, distribution }
}

export async function getMyRating(slug: string): Promise<Score | null> {
  await delay(100)
  const user = await requireUser()
  return loadRatings()[user.id]?.[slug] ?? null
}

export async function rateStory(slug: string, score: Score) {
  await delay(300)
  const user = await requireUser()
  const ratings = loadRatings()
  saveRatings({ ...ratings, [user.id]: { ...ratings[user.id], [slug]: score } })
  return score
}
