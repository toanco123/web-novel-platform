// Bình luận và chấm điểm giả (bình luận mẫu + localStorage): dùng cho test tự động và khi chạy không
// có Supabase (xem api.ts). Bản thật: api.remote.ts.
import {
  AuthError,
  duplicateComment,
  getProfiles,
  getUserId,
  rateLimited,
  requireUser,
} from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import {
  blockedIds,
  loadCommentReports,
  loadRatings,
  loadUserComments,
  ratingsOf,
  removeComments,
  saveCommentReports,
  saveRatings,
  saveUserComments,
} from '@/mocks/activity'
import { findStory } from '@/mocks/catalog'
import { countSince, HOUR, MINUTE } from '@/mocks/rateLimit'
import { seedChapterComments, seedComments } from '@/mocks/comments'
import type { Comment, RatingSummary, Score } from '@/types/comment'
import {
  commentGone,
  COMMENTS_PER_PAGE,
  type CommentPage,
  invalidParent,
  ownCommentReport,
  parentDeleted,
  REPLIES_LIMIT,
  type ReportCommentInput,
} from './shared'

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

/** Tên và ảnh lấy theo hồ sơ hiện tại (người dùng có thể đã đổi sau khi bình luận) */
async function withProfiles(comments: Comment[]) {
  const profiles = await getProfiles(comments.map((c) => c.user.id))
  return comments.map((c) => ({ ...c, user: profiles.get(c.user.id) ?? c.user }))
}

/** Ẩn bình luận của người mà người xem đã chặn, kể cả trong số trả lời (như policy đọc comments) */
async function visibleTo() {
  const hidden = blockedIds(await getUserId())
  return (c: Comment) => !hidden.has(c.user.id)
}

/**
 * Bình luận gốc của truyện (chapter = null, mặc định) hoặc của một chương, mới nhất trước; mỗi bình
 * luận kèm số trả lời
 */
export async function getComments(
  slug: string,
  { chapter = null, cursor = 0 }: { chapter?: number | null; cursor?: number } = {},
): Promise<CommentPage> {
  await delay()
  const visible = await visibleTo()
  const stored = loadUserComments().filter(visible)
  const own = stored.filter(
    (c) => c.storySlug === slug && c.chapterNumber === chapter && !c.parentId,
  )
  const all = [...own, ...seeded(slug, chapter).filter(visible)].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
  const page = all.slice(cursor, cursor + COMMENTS_PER_PAGE)
  const items = (await withProfiles(page)).map((c) => ({
    ...c,
    replyCount: stored.filter((r) => r.parentId === c.id).length,
  }))
  const next = cursor + items.length
  return { items, total: all.length, nextCursor: next < all.length ? next : null }
}

/** Trả lời của một bình luận, cũ nhất trước */
export async function getReplies(commentId: string): Promise<Comment[]> {
  await delay()
  const visible = await visibleTo()
  const replies = loadUserComments()
    .filter((c) => c.parentId === commentId && visible(c))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(0, REPLIES_LIMIT)
  return withProfiles(replies)
}

/** parentId có giá trị: trả lời bình luận gốc đó (cùng truyện, cùng chương) */
export async function addComment(
  slug: string,
  content: string,
  chapter: number | null = null,
  parentId: string | null = null,
): Promise<Comment> {
  await delay(400)
  const user = await requireUser()
  const all = loadUserComments()
  if (parentId) {
    const stored = all.find((c) => c.id === parentId)
    if (
      stored &&
      (stored.parentId || stored.storySlug !== slug || stored.chapterNumber !== chapter)
    )
      throw invalidParent()
    if (!stored && !seeded(slug, chapter).some((c) => c.id === parentId)) throw parentDeleted()
  }
  const mine = all.filter((c) => c.user.id === user.id)
  if (
    mine.some(
      (c) =>
        c.storySlug === slug &&
        c.chapterNumber === chapter &&
        c.content === content.trim() &&
        countSince([c.createdAt], 10 * MINUTE) > 0,
    )
  ) {
    throw duplicateComment()
  }
  const times = mine.map((c) => c.createdAt)
  if (countSince(times, MINUTE) >= 3 || countSince(times, HOUR) >= 30) throw rateLimited()
  const comment: Comment = {
    id: crypto.randomUUID(),
    storySlug: slug,
    chapterNumber: chapter,
    // Không chép ảnh đại diện (data URL) vào từng bình luận; khi đọc sẽ lấy theo hồ sơ
    user: { id: user.id, displayName: user.displayName, avatarUrl: null },
    content: content.trim(),
    createdAt: new Date().toISOString(),
    parentId,
    replyCount: 0,
  }
  saveUserComments([comment, ...all])
  return comment
}

/** Chỉ xóa được bình luận của chính mình; trả lời của bình luận đó bị xóa theo */
export async function deleteComment(id: string) {
  await delay(300)
  const user = await requireUser()
  removeComments((c) => c.id === id && c.user.id === user.id)
}

/**
 * Báo cáo bình luận của người khác (cần đăng nhập). Đã có báo cáo đang mở cho bình luận này thì
 * chỉ cập nhật lý do và ghi chú. Tối đa 10 báo cáo mới / giờ.
 */
export async function reportComment({ commentId, reason, note }: ReportCommentInput) {
  await delay(400)
  const user = await requireUser()
  // Bình luận mẫu sinh sẵn trong code, quản trị viên không xóa được
  if (commentId.startsWith('seed-')) {
    throw new AuthError('unknown', 'Bản thử nghiệm không báo cáo được bình luận mẫu.')
  }
  const comment = loadUserComments().find((c) => c.id === commentId)
  if (!comment) throw commentGone()
  if (comment.user.id === user.id) throw ownCommentReport()
  const reports = loadCommentReports()
  const mine = reports.filter((r) => r.reporter.id === user.id)
  const existing = mine.find((r) => r.commentId === commentId && r.status === 'open')
  const now = new Date().toISOString()
  if (existing) {
    const updated = { ...existing, reason, note: note.trim(), createdAt: now }
    saveCommentReports(reports.map((r) => (r === existing ? updated : r)))
    return
  }
  if (
    countSince(
      mine.map((r) => r.createdAt),
      HOUR,
    ) >= 10
  )
    throw rateLimited()
  saveCommentReports([
    {
      id: crypto.randomUUID(),
      commentId,
      reporter: { id: user.id, displayName: user.displayName },
      reason,
      note: note.trim(),
      status: 'open',
      createdAt: now,
    },
    ...reports,
  ])
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
