// Trang quản trị trên dữ liệu giả (localStorage): dùng cho test tự động và khi chạy không có
// Supabase (xem api.ts). Bản thật: api.remote.ts. Mọi hàm chỉ cho quản trị viên.
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { paginate } from '@/lib/pagination'
import { slugify } from '@/lib/slugify'
import {
  dayKey,
  followerCount,
  loadAllFollows,
  loadCommentReports,
  loadContactMessages,
  loadReports,
  loadUserComments,
  loadViews,
  removeComments,
  saveCommentReports,
  saveContactMessages,
  saveReports,
} from '@/mocks/activity'
import { allGenres, toStory } from '@/mocks/catalog'
import { mockChapters } from '@/mocks/chapters'
import { loadCurated, saveCurated } from '@/mocks/curated'
import { genres as seedGenres, stories as seedStories } from '@/mocks/stories'
import {
  loadChapters,
  loadUserGenres,
  loadUserStories,
  saveUserGenres,
  saveUserStories,
  storyReview,
} from '@/mocks/userContent'
import { loadUsers, saveUsers } from '@/mocks/users'
import { normalizeGenreName } from '@/features/genres/api'
import type { Page } from '@/types/page'
import type { CuratedList, Genre } from '@/types/story'
import {
  AdminError,
  adminPageSize,
  CURATED_LIMITS,
  type AdminComment,
  type AdminCommentQuery,
  type AdminContactMessage,
  type AdminMessageQuery,
  type AdminOverview,
  type AdminReport,
  type AdminReportQuery,
  type AdminStory,
  type AdminStoryQuery,
  type AdminUser,
  type AdminUserQuery,
  type CuratedStory,
  type ReviewInput,
  type SortOrder,
} from './shared'

const SYSTEM_AUTHOR = 'Hệ thống'

async function requireAdmin() {
  const user = await requireUser()
  if (!user.isAdmin) throw new AdminError()
  return user
}

const matches = (q: string, ...fields: string[]) => !q || fields.some((f) => slugify(f).includes(q))

/**
 * Hàm so sánh theo một khóa: chuỗi so theo tiếng Việt, số và ngày ISO so trực tiếp; giá trị trống
 * luôn xếp cuối (như `nulls last` của bản thật). Bằng nhau thì giữ thứ tự cũ.
 */
function by<T>(key: (item: T) => string | number | null | undefined, order: SortOrder = 'desc') {
  const sign = order === 'asc' ? 1 : -1
  return (a: T, b: T) => {
    const ka = key(a) ?? null
    const kb = key(b) ?? null
    if (ka === null || kb === null) return ka === kb ? 0 : ka === null ? 1 : -1
    return sign * (typeof ka === 'number' && typeof kb === 'number' ? ka - kb : compareText(ka, kb))
  }
}
const compareText = (a: string | number, b: string | number) =>
  String(a).localeCompare(String(b), 'vi')

/** Mọi truyện (có sẵn + của người dùng, kể cả nháp) */
function allStories(): AdminStory[] {
  const comments = loadUserComments()
  const reports = loadReports()
  const countBy = <T extends { storySlug: string }>(list: T[], slug: string) =>
    list.filter((x) => x.storySlug === slug).length

  const seeds = seedStories.map((s): AdminStory => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    ownerId: null,
    ownerName: SYSTEM_AUTHOR,
    visibility: s.visibility,
    status: s.status,
    publishedCount: s.chapterCount,
    chapterCount: s.chapterCount,
    views: s.viewCount,
    followers: followerCount(s.slug),
    ratingAvg: s.ratingAvg,
    ratingCount: s.ratingCount,
    comments: countBy(comments, s.slug),
    openReports: countBy(
      reports.filter((r) => r.status === 'open'),
      s.slug,
    ),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    takedown: null,
  }))

  const genres = allGenres()
  const views = loadViews()
  const mine = loadUserStories().map((stored): AdminStory => {
    const story = toStory(stored, genres, views)
    return {
      id: stored.id,
      slug: stored.slug,
      title: stored.title,
      ownerId: stored.owner.id,
      ownerName: stored.owner.displayName,
      visibility: stored.visibility,
      status: stored.status,
      publishedCount: story.chapterCount,
      chapterCount: loadChapters(stored.id).length,
      views: story.viewCount,
      followers: followerCount(stored.slug),
      ratingAvg: story.ratingAvg,
      ratingCount: story.ratingCount,
      comments: countBy(comments, stored.slug),
      openReports: countBy(
        reports.filter((r) => r.status === 'open'),
        stored.slug,
      ),
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      takedown: stored.takedown ?? null,
    }
  })

  return [...seeds, ...mine]
}

export async function getAdminOverview(days: number): Promise<AdminOverview> {
  await delay()
  await requireAdmin()

  const today = new Date()
  const keys = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    return dayKey(d)
  })
  const inPeriod = new Set(keys)
  const dayOf = (iso: string | null | undefined) => (iso ? dayKey(new Date(iso)) : null)
  const countByDay = (dates: (string | null | undefined)[]) => {
    const counts = new Map<string, number>()
    for (const day of dates.map(dayOf)) {
      if (day && inPeriod.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    return counts
  }

  const users = loadUsers()
  const stories = allStories()
  const userStories = loadUserStories()
  const chapters = userStories.flatMap((s) => loadChapters(s.id))
  const views = loadViews()
  const viewsByDay = new Map<string, number>()
  for (const stats of Object.values(views)) {
    for (const [day, n] of Object.entries(stats.byDay)) {
      if (inPeriod.has(day)) viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + n)
    }
  }
  const signups = countByDay(users.map((u) => u.createdAt))
  const newStories = countByDay(userStories.map((s) => s.createdAt))
  const newChapters = countByDay(chapters.map((c) => c.publishedAt))

  const published = stories.filter((s) => s.visibility === 'published')
  const genreCounts = new Map<string, number>()
  const genreNames = new Map(allGenres().map((g) => [g.slug, g.name]))
  const genreSlugsOf = (id: string) =>
    seedStories.find((s) => s.id === id)?.genres.map((g) => g.slug) ??
    userStories.find((s) => s.id === id)?.genreSlugs ??
    []
  for (const story of published) {
    for (const slug of genreSlugsOf(story.id)) {
      const name = genreNames.get(slug)
      if (name) genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1)
    }
  }

  return {
    totals: {
      users: users.length,
      newUsers: [...signups.values()].reduce((a, b) => a + b, 0),
      publishedStories: published.length,
      draftStories: stories.length - published.length,
      publishedChapters: stories.reduce((sum, s) => sum + s.publishedCount, 0),
      views: stories.reduce((sum, s) => sum + s.views, 0),
      viewsInPeriod: [...viewsByDay.values()].reduce((a, b) => a + b, 0),
      comments: loadUserComments().length,
      openReports: loadReports().filter((r) => r.status === 'open').length,
      reportedComments: reportedCommentIds().size,
      unhandledMessages: loadContactMessages().filter((m) => !m.handledAt).length,
      bannedUsers: users.filter((u) => u.bannedAt).length,
    },
    days: keys.map((day) => ({
      day,
      signups: signups.get(day) ?? 0,
      views: viewsByDay.get(day) ?? 0,
      stories: newStories.get(day) ?? 0,
      chapters: newChapters.get(day) ?? 0,
    })),
    genres: [...genreCounts]
      .map(([name, count]) => ({ name, stories: count }))
      .sort((a, b) => b.stories - a.stories || a.name.localeCompare(b.name, 'vi'))
      .slice(0, 10),
    topStories: stories
      .filter((s) => s.views > 0)
      .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title, 'vi'))
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        visibility: s.visibility,
        authorName: s.ownerName,
        views: s.views,
        followers: s.followers,
        ratingAvg: s.ratingAvg,
        ratingCount: s.ratingCount,
      })),
  }
}

const userSortKeys: Record<
  NonNullable<AdminUserQuery['sort']>,
  (u: AdminUser) => string | number | null
> = {
  name: (u) => u.displayName,
  created: (u) => u.createdAt,
  lastSignIn: (u) => u.lastSignInAt,
  stories: (u) => u.storyCount,
  comments: (u) => u.commentCount,
  follows: (u) => u.followCount,
}

export async function getAdminUsers({
  q = '',
  role,
  status,
  provider,
  sort = 'created',
  order,
  page,
  pageSize,
}: AdminUserQuery): Promise<Page<AdminUser>> {
  await delay()
  await requireAdmin()
  const query = slugify(q)
  const stories = loadUserStories()
  const comments = loadUserComments()
  const follows = loadAllFollows()
  const users = loadUsers()
    .filter((u) => matches(query, u.displayName, u.email))
    .map((u): AdminUser => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      provider: u.provider,
      isAdmin: u.role === 'admin',
      createdAt: u.createdAt ?? null,
      lastSignInAt: u.lastSignInAt ?? null,
      storyCount: stories.filter((s) => s.owner.id === u.id).length,
      commentCount: comments.filter((c) => c.user.id === u.id).length,
      followCount: follows[u.id]?.length ?? 0,
      isBanned: !!u.bannedAt,
    }))
    .filter(
      (u) =>
        (!role || u.isAdmin === (role === 'admin')) &&
        (!status || u.isBanned === (status === 'banned')) &&
        (!provider || u.provider === provider),
    )
    .sort(by(userSortKeys[sort], order))
  return paginate(users, page, adminPageSize(pageSize))
}

const storySortKeys: Record<
  NonNullable<AdminStoryQuery['sort']>,
  (s: AdminStory) => string | number
> = {
  title: (s) => s.title,
  chapters: (s) => s.publishedCount,
  views: (s) => s.views,
  followers: (s) => s.followers,
  rating: (s) => s.ratingAvg,
  comments: (s) => s.comments,
  reports: (s) => s.openReports,
  created: (s) => s.createdAt,
  updated: (s) => s.updatedAt,
}

export async function getAdminStories({
  q = '',
  visibility,
  status,
  hasReports,
  ownerId,
  sort = 'updated',
  order,
  page,
  pageSize,
}: AdminStoryQuery): Promise<Page<AdminStory>> {
  await delay()
  await requireAdmin()
  const query = slugify(q)
  const stories = allStories()
    .filter(
      (s) =>
        matches(query, s.title, s.ownerName) &&
        (!visibility || (visibility === 'takedown' ? !!s.takedown : s.visibility === visibility)) &&
        (!status || s.status === status) &&
        (!hasReports || s.openReports > 0) &&
        (!ownerId || s.ownerId === ownerId),
    )
    // Khóa phụ: mới cập nhật trước
    .sort(by((s) => s.updatedAt))
    .sort(by(storySortKeys[sort], order))
  return paginate(stories, page, adminPageSize(pageSize))
}

// ── Hộp thư & báo lỗi ───────────────────────────────────────────────────

export async function getAdminMessages({
  status,
  topic,
  q = '',
  order,
  page,
  pageSize,
}: AdminMessageQuery): Promise<Page<AdminContactMessage>> {
  await delay()
  await requireAdmin()
  const query = slugify(q)
  const messages = loadContactMessages()
    .filter(
      (m) =>
        (status === 'all' || (status === 'open') === !m.handledAt) &&
        (!topic || m.topic === topic) &&
        matches(query, m.name, m.email, m.message),
    )
    .map(({ sentAt, ...m }) => ({ ...m, createdAt: sentAt }))
    .sort(by((m) => m.createdAt, order))
  return paginate(messages, page, adminPageSize(pageSize))
}

export async function setMessageHandled(id: string, handled: boolean) {
  await delay()
  await requireAdmin()
  const now = new Date().toISOString()
  saveContactMessages(
    loadContactMessages().map((m) =>
      m.id === id ? { ...m, handledAt: handled ? (m.handledAt ?? now) : null } : m,
    ),
  )
}

/** Tên truyện, trạng thái công khai và tên chương cho một báo lỗi */
function reportTarget(slug: string, number: number) {
  const seed = seedStories.find((s) => s.slug === slug)
  if (seed) {
    const chapter = mockChapters(seed).find((c) => c.number === number)
    return { title: seed.title, published: true, chapterTitle: chapter?.title ?? '' }
  }
  const stored = loadUserStories().find((s) => s.slug === slug)
  if (!stored) return null
  const chapter = loadChapters(stored.id).find((c) => c.number === number)
  return {
    title: stored.title,
    published: stored.visibility === 'published',
    chapterTitle: chapter?.title ?? '',
  }
}

export async function getAdminReports({
  status,
  reason,
  q = '',
  order,
  page,
  pageSize,
}: AdminReportQuery): Promise<Page<AdminReport>> {
  await delay()
  await requireAdmin()
  const query = slugify(q)
  const names = new Map(loadUsers().map((u) => [u.id, u.displayName]))
  const reports = loadReports()
    .filter((r) => (status === 'all' || r.status === status) && (!reason || r.reason === reason))
    .flatMap((r): AdminReport[] => {
      const target = reportTarget(r.storySlug, r.chapterNumber)
      if (!target) return []
      const reporter = {
        ...r.reporter,
        displayName: names.get(r.reporter.id) ?? r.reporter.displayName,
      }
      if (!matches(query, target.title, r.note, reporter.displayName)) return []
      return [
        {
          id: r.id,
          storySlug: r.storySlug,
          storyTitle: target.title,
          storyPublished: target.published,
          chapterNumber: r.chapterNumber,
          chapterTitle: target.chapterTitle,
          reason: r.reason,
          note: r.note,
          status: r.status,
          reporter,
          createdAt: r.createdAt,
        },
      ]
    })
    .sort(by((r) => r.createdAt, order))
  return paginate(reports, page, adminPageSize(pageSize))
}

export async function setAdminReportStatus(id: string, status: AdminReport['status']) {
  await delay()
  await requireAdmin()
  saveReports(loadReports().map((r) => (r.id === id ? { ...r, status } : r)))
}

// ── Bình luận ───────────────────────────────────────────────────────────

/** Id các bình luận (còn tồn tại) đang có báo cáo chưa xử lý */
function reportedCommentIds() {
  const existing = new Set(loadUserComments().map((c) => c.id))
  return new Set(
    loadCommentReports()
      .filter((r) => r.status === 'open' && existing.has(r.commentId))
      .map((r) => r.commentId),
  )
}

/** Bình luận do người dùng viết (bình luận mẫu của bản giả không nằm ở đây) */
export async function getAdminComments({
  view,
  q = '',
  kind,
  sort = view === 'reported' ? 'reported' : 'created',
  order,
  page,
  pageSize,
}: AdminCommentQuery): Promise<Page<AdminComment>> {
  await delay()
  await requireAdmin()
  const query = slugify(q)
  const stored = loadUserComments()
  const names = new Map(loadUsers().map((u) => [u.id, u.displayName]))
  const openReports = loadCommentReports()
    .filter((r) => r.status === 'open')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const titles = new Map<string, { title: string; published: boolean }>([
    ...seedStories.map((s) => [s.slug, { title: s.title, published: true }] as const),
    ...loadUserStories().map(
      (s) => [s.slug, { title: s.title, published: s.visibility === 'published' }] as const,
    ),
  ])

  const comments = stored.flatMap((c): AdminComment[] => {
    const story = titles.get(c.storySlug)
    if (!story) return []
    const displayName = names.get(c.user.id) ?? c.user.displayName
    if (!matches(query, c.content, displayName)) return []
    if (kind && (kind === 'reply') !== !!c.parentId) return []
    return [
      {
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        isReply: !!c.parentId,
        replyCount: stored.filter((r) => r.parentId === c.id).length,
        author: { id: c.user.id, displayName },
        storySlug: c.storySlug,
        storyTitle: story.title,
        storyPublished: story.published,
        chapterNumber: c.chapterNumber,
        reports: openReports
          .filter((r) => r.commentId === c.id)
          .map((r) => ({
            reason: r.reason,
            note: r.note,
            reporterName: names.get(r.reporter.id) ?? r.reporter.displayName,
            createdAt: r.createdAt,
          })),
      },
    ]
  })
  const shown = (view === 'reported' ? comments.filter((c) => c.reports.length > 0) : comments)
    // Khóa phụ: mới viết trước
    .sort(by((c) => c.createdAt))
    .sort(by((c) => (sort === 'reported' ? c.reports[0]?.createdAt : c.createdAt), order))
  return paginate(shown, page, adminPageSize(pageSize))
}

/** Xóa bình luận của bất kỳ ai, kèm trả lời và báo cáo của nó */
export async function deleteAdminComment(id: string) {
  await delay()
  await requireAdmin()
  if (removeComments((c) => c.id === id) === 0) throw new AdminError('not_found')
}

/** Đóng mọi báo cáo đang mở của một bình luận, bình luận giữ nguyên */
export async function dismissCommentReports(commentId: string) {
  await delay()
  await requireAdmin()
  saveCommentReports(
    loadCommentReports().map((r) =>
      r.commentId === commentId && r.status === 'open' ? { ...r, status: 'resolved' as const } : r,
    ),
  )
}

// ── Khóa tài khoản, gỡ truyện ───────────────────────────────────────────

export async function setUserBanned(userId: string, banned: boolean) {
  await delay()
  const admin = await requireAdmin()
  if (userId === admin.id) throw new AdminError('cannot_ban_self')
  const users = loadUsers()
  const target = users.find((u) => u.id === userId)
  if (!target) throw new AdminError('not_found')
  if (banned && target.role === 'admin') throw new AdminError('cannot_ban_admin')
  const bannedAt = banned ? (target.bannedAt ?? new Date().toISOString()) : null
  saveUsers(users.map((u) => (u.id === userId ? { ...u, bannedAt } : u)))
}

/** reason null/rỗng: khôi phục (truyện vẫn là nháp, tác giả tự xuất bản lại) */
export async function setStoryTakedown(storyId: string, reason: string | null) {
  await delay()
  await requireAdmin()
  const stories = loadUserStories()
  const story = stories.find((s) => s.id === storyId)
  // Truyện có sẵn của bản giả không gỡ được (không lưu trong localStorage)
  if (!story) throw new AdminError('not_found')
  const text = reason?.trim()
  saveUserStories(
    stories.map((s) =>
      s.id !== storyId
        ? s
        : text
          ? {
              ...s,
              visibility: 'draft' as const,
              takedown: { at: s.takedown?.at ?? new Date().toISOString(), reason: text },
              // Gỡ thì mất dấu đã duyệt (truyện chờ duyệt cũng rời hàng chờ)
              review: null,
            }
          : // Đọc khi truyện còn bị gỡ nên là null: dữ liệu cũ không tự thành đã duyệt
            { ...s, takedown: null, review: storyReview(s) },
    ),
  )
}

/** Duyệt (công khai luôn) hoặc từ chối (kèm lý do) truyện đang chờ duyệt */
export async function reviewStory({ storyId, approve, reason }: ReviewInput) {
  await delay()
  await requireAdmin()
  const stories = loadUserStories()
  const story = stories.find((s) => s.id === storyId)
  if (!story) throw new AdminError('not_found')
  const review = storyReview(story)
  if (review?.status !== 'pending') throw new AdminError('not_pending')
  const text = reason?.trim() ?? ''
  if (!approve && !text) throw new AdminError('reason_required')
  const time = new Date().toISOString()
  saveUserStories(
    stories.map((s) =>
      s.id !== storyId
        ? s
        : approve
          ? {
              ...s,
              visibility: 'published' as const,
              publishedAt: s.publishedAt ?? time,
              updatedAt: time,
              review: { ...review, status: 'approved' as const, reviewedAt: time, reason: null },
            }
          : {
              ...s,
              updatedAt: time,
              review: { ...review, status: 'rejected' as const, reviewedAt: time, reason: text },
            },
    ),
  )
}

// ── Thể loại ────────────────────────────────────────────────────────────
// Bản giả chỉ sửa được thể loại do người dùng tạo (thể loại có sẵn nằm trong code)

function userGenre(slug: string) {
  if (seedGenres.some((g) => g.slug === slug)) throw new AdminError('builtin_genre')
  const genre = loadUserGenres().find((g) => g.slug === slug)
  if (!genre) throw new AdminError('not_found')
  return genre
}

/** Đổi thể loại của mọi truyện người dùng: from → to (null: bỏ), không để trùng */
function replaceStoryGenre(from: string, to: string | null) {
  saveUserStories(
    loadUserStories().map((s) =>
      s.genreSlugs.includes(from)
        ? {
            ...s,
            genreSlugs: [
              ...new Set(s.genreSlugs.flatMap((g) => (g === from ? (to ? [to] : []) : [g]))),
            ],
          }
        : s,
    ),
  )
}

export async function updateGenre(
  slug: string,
  input: { name: string; description: string },
): Promise<Genre> {
  await delay()
  await requireAdmin()
  const genre = userGenre(slug)
  const { name, slug: nextSlug } = normalizeGenreName(input.name)
  if (nextSlug !== slug && allGenres().some((g) => g.slug === nextSlug)) {
    throw new AdminError('genre_exists')
  }
  const updated = {
    ...genre,
    name,
    slug: nextSlug,
    description: input.description.trim() || undefined,
  }
  saveUserGenres(loadUserGenres().map((g) => (g.slug === slug ? updated : g)))
  if (nextSlug !== slug) replaceStoryGenre(slug, nextSlug)
  // Giống RPC admin_update_genre: chỉ trả tên, slug, mô tả
  return { slug: updated.slug, name: updated.name, description: updated.description }
}

export async function deleteGenre(slug: string) {
  await delay()
  await requireAdmin()
  userGenre(slug)
  saveUserGenres(loadUserGenres().filter((g) => g.slug !== slug))
  replaceStoryGenre(slug, null)
}

/** Gộp `from` vào `into`; trả về số truyện được chuyển sang */
export async function mergeGenres(from: string, into: string): Promise<number> {
  await delay()
  await requireAdmin()
  if (from === into) throw new AdminError('same_genre')
  userGenre(from)
  if (!allGenres().some((g) => g.slug === into)) throw new AdminError('not_found')
  const moved = loadUserStories().filter(
    (s) => s.genreSlugs.includes(from) && !s.genreSlugs.includes(into),
  ).length
  saveUserGenres(loadUserGenres().filter((g) => g.slug !== from))
  replaceStoryGenre(from, into)
  return moved
}

// ── Truyện chọn tay trên trang chủ ──────────────────────────────────────

/** Danh sách đã chọn theo thứ tự, kể cả truyện đang ẩn (để admin thấy và bỏ đi) */
export async function getCuratedStories(list: CuratedList): Promise<CuratedStory[]> {
  await delay()
  await requireAdmin()
  const stories = new Map(allStories().map((s) => [s.id, s]))
  const penNames = new Map(loadUserStories().map((s) => [s.id, s.authorName]))
  return loadCurated(list).flatMap((id): CuratedStory[] => {
    const story = stories.get(id)
    if (!story) return []
    return [
      {
        id: story.id,
        slug: story.slug,
        title: story.title,
        authorName: penNames.get(id) || story.ownerName,
        isPublic: story.visibility === 'published' && story.publishedCount > 0,
      },
    ]
  })
}

/** Thay cả danh sách theo thứ tự đưa vào (id lặp lại chỉ giữ lần đầu); rỗng: trang chủ tự chọn */
export async function setCuratedStories(list: CuratedList, storyIds: string[]) {
  await delay()
  await requireAdmin()
  const ids = [...new Set(storyIds)]
  if (ids.length > CURATED_LIMITS[list]) throw new AdminError('too_many_curated')
  const known = new Set(allStories().map((s) => s.id))
  if (ids.some((id) => !known.has(id))) throw new AdminError('not_found')
  saveCurated(list, ids)
}
