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
  loadCommentLikes,
  loadCommentReports,
  loadRatings,
  loadUserComments,
  ratingsOf,
  removeComments,
  saveCommentLikes,
  saveCommentReports,
  saveRatings,
  saveUserComments,
} from '@/mocks/activity'
import { findStory } from '@/mocks/catalog'
import { countSince, HOUR, MINUTE } from '@/mocks/rateLimit'
import { seedChapterComments, seedComments } from '@/mocks/comments'
import { loadUserStories } from '@/mocks/userContent'
import type { Comment, CommentSort, RatingSummary, Score } from '@/types/comment'
import {
  commentGone,
  COMMENTS_PER_PAGE,
  type CommentPage,
  invalidParent,
  LIKES_PER_HOUR,
  ownCommentLike,
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

/** Chủ truyện người dùng đăng và truyện có bút danh không (truyện mẫu: null) */
function storyOwner(slug: string) {
  const story = loadUserStories().find((s) => s.slug === slug)
  return story ? { id: story.owner.id, penName: !!story.authorName } : null
}

/** Bình luận mẫu theo id (`seed-<slug>-<i>` hoặc `seed-<slug>-c<chương>-<i>`) */
function findSeed(id: string) {
  const match = /^seed-(.+?)-(?:c(\d+)-)?\d+$/.exec(id)
  if (!match) return undefined
  const chapter = match[2] ? Number(match[2]) : null
  return seeded(match[1], chapter).find((c) => c.id === id)
}

/** Số lượt thích: lượt gốc (chỉ bình luận mẫu có) cộng lượt thích thật */
function likeCounter() {
  const counts = new Map<string, number>()
  for (const like of loadCommentLikes()) {
    counts.set(like.commentId, (counts.get(like.commentId) ?? 0) + 1)
  }
  return (c: Comment) => c.likeCount + (counts.get(c.id) ?? 0)
}

/**
 * Điền các trường tính khi đọc: tên, ảnh theo hồ sơ, số trả lời (đếm trong `stored`, đã lọc người
 * bị chặn), lượt thích, nhãn Tác giả
 */
async function present(comments: Comment[], stored: Comment[]) {
  const viewerId = await getUserId()
  const likes = loadCommentLikes()
  const countLikes = likeCounter()
  return (await withProfiles(comments)).map((c) => {
    const owner = storyOwner(c.storySlug)
    return {
      ...c,
      replyCount: c.parentId ? 0 : stored.filter((r) => r.parentId === c.id).length,
      likeCount: countLikes(c),
      likedByMe: !!viewerId && likes.some((l) => l.commentId === c.id && l.userId === viewerId),
      isAuthor: !!owner && !owner.penName && owner.id === c.user.id,
    }
  })
}

const newestFirst = (a: Comment, b: Comment) => Date.parse(b.createdAt) - Date.parse(a.createdAt)

/**
 * Bình luận gốc của truyện (chapter = null, mặc định) hoặc của một chương; mỗi bình luận kèm số
 * trả lời. sort: mới nhất trước (mặc định) | nhiều lượt thích trước
 */
export async function getComments(
  slug: string,
  {
    chapter = null,
    cursor = 0,
    sort = 'newest',
  }: { chapter?: number | null; cursor?: number; sort?: CommentSort } = {},
): Promise<CommentPage> {
  await delay()
  const visible = await visibleTo()
  const stored = loadUserComments().filter(visible)
  const own = stored.filter(
    (c) => c.storySlug === slug && c.chapterNumber === chapter && !c.parentId,
  )
  const countLikes = likeCounter()
  const all = [...own, ...seeded(slug, chapter).filter(visible)].sort(
    sort === 'top' ? (a, b) => countLikes(b) - countLikes(a) || newestFirst(a, b) : newestFirst,
  )
  const items = await present(all.slice(cursor, cursor + COMMENTS_PER_PAGE), stored)
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
  return present(replies, [])
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
    likeCount: 0,
    likedByMe: false,
    editedAt: null,
    isAuthor: false,
  }
  saveUserComments([comment, ...all])
  return (await present([comment], []))[0]
}

/**
 * Sửa bình luận của chính mình khi truyện còn công khai. Nội dung đổi thì đặt editedAt; không có
 * bình luận đó (hoặc của người khác) thì báo bình luận không còn
 */
export async function editComment(commentId: string, content: string): Promise<Comment> {
  await delay(300)
  const user = await requireUser()
  const all = loadUserComments()
  const target = all.find((c) => c.id === commentId && c.user.id === user.id)
  if (!target || !findStory(target.storySlug)) throw commentGone()
  const text = content.trim()
  const updated =
    text === target.content
      ? target
      : { ...target, content: text, editedAt: new Date().toISOString() }
  saveUserComments(all.map((c) => (c.id === commentId ? updated : c)))
  return (await present([updated], all))[0]
}

/**
 * Thích (liked = true) hoặc bỏ thích bình luận của người khác trong truyện đang công khai. Thích
 * lại khi đã thích, hay bỏ thích khi chưa thích, không làm gì. Tối đa 300 lượt thích mới / giờ.
 */
export async function setCommentLike(commentId: string, liked: boolean) {
  await delay(150)
  const user = await requireUser()
  const likes = loadCommentLikes()
  const mine = likes.filter((l) => l.userId === user.id)
  const has = mine.some((l) => l.commentId === commentId)
  if (!liked) {
    if (has)
      saveCommentLikes(likes.filter((l) => l.userId !== user.id || l.commentId !== commentId))
    return
  }
  if (has) return
  const comment = loadUserComments().find((c) => c.id === commentId) ?? findSeed(commentId)
  if (!comment || !findStory(comment.storySlug)) throw commentGone()
  if (comment.user.id === user.id) throw ownCommentLike()
  if (
    countSince(
      mine.map((l) => l.createdAt),
      HOUR,
    ) >= LIKES_PER_HOUR
  )
    throw rateLimited()
  saveCommentLikes([...likes, { commentId, userId: user.id, createdAt: new Date().toISOString() }])
}

/**
 * Xóa bình luận của chính mình, hoặc bất kỳ bình luận nào trong truyện mình là chủ; trả lời của
 * bình luận đó bị xóa theo. Không có quyền thì bỏ qua (như RLS)
 */
export async function deleteComment(id: string) {
  await delay(300)
  const user = await requireUser()
  removeComments(
    (c) => c.id === id && (c.user.id === user.id || storyOwner(c.storySlug)?.id === user.id),
  )
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
    const updated = {
      ...existing,
      reason,
      note: note.trim(),
      createdAt: now,
      contentSnapshot: comment.content,
    }
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
      contentSnapshot: comment.content,
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
