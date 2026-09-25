// Nơi DUY NHẤT xử lý bình luận và chấm điểm. Giai đoạn UI: bình luận mẫu + localStorage.
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay, readMock, writeMock } from '@/lib/mockStorage'
import { seedComments } from '@/mocks/comments'
import { stories } from '@/mocks/stories'
import type { Comment, RatingSummary, Score } from '@/types/comment'

export const COMMENTS_PER_PAGE = 10

const COMMENTS_KEY = 'mock-comments'
const RATINGS_KEY = 'mock-ratings'
type Ratings = Record<string, Record<string, Score>> // userId → slug → điểm

const seedCache = new Map<string, Comment[]>()
function seeded(slug: string) {
  if (!seedCache.has(slug)) {
    const story = stories.find((s) => s.slug === slug)
    seedCache.set(slug, story ? seedComments(story) : [])
  }
  return seedCache.get(slug)!
}

const userComments = () => readMock<Comment[]>(COMMENTS_KEY, [])

export async function getComments(slug: string, cursor = 0) {
  await delay()
  const all = [...userComments().filter((c) => c.storySlug === slug), ...seeded(slug)].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
  const items = all.slice(cursor, cursor + COMMENTS_PER_PAGE)
  const next = cursor + items.length
  return { items, total: all.length, nextCursor: next < all.length ? next : null }
}

export async function addComment(slug: string, content: string): Promise<Comment> {
  await delay(400)
  const user = await requireUser()
  const comment: Comment = {
    id: crypto.randomUUID(),
    storySlug: slug,
    user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl },
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }
  writeMock(COMMENTS_KEY, [comment, ...userComments()])
  return comment
}

/** Chỉ xóa được bình luận của chính mình */
export async function deleteComment(id: string) {
  await delay(300)
  const user = await requireUser()
  writeMock(
    COMMENTS_KEY,
    userComments().filter((c) => !(c.id === id && c.user.id === user.id)),
  )
}

const loadRatings = () => readMock<Ratings>(RATINGS_KEY, {})

/** Phân bố 5→1 sao suy ra từ điểm trung bình gốc (dữ liệu giả, chỉ để vẽ biểu đồ) */
function baseDistribution(average: number, count: number): Record<Score, number> {
  const weights = ([1, 2, 3, 4, 5] as Score[]).map((k) => Math.exp(-((k - average) ** 2) / 0.8))
  const sum = weights.reduce((a, b) => a + b, 0)
  const [d1, d2, d3, d4, d5] = weights.map((w) => Math.round((w / sum) * count))
  return { 1: d1, 2: d2, 3: d3, 4: d4, 5: d5 }
}

export async function getRatingSummary(slug: string): Promise<RatingSummary> {
  await delay()
  const story = stories.find((s) => s.slug === slug)
  const base = story
    ? { average: story.ratingAvg, count: story.ratingCount }
    : { average: 0, count: 0 }
  const distribution = baseDistribution(base.average, base.count)
  const extra = Object.values(loadRatings())
    .map((byStory) => byStory[slug])
    .filter((s): s is Score => !!s)
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
  writeMock(RATINGS_KEY, { ...ratings, [user.id]: { ...ratings[user.id], [slug]: score } })
  return score
}
