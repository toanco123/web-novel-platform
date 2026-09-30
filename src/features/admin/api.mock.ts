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
  loadContactMessages,
  loadReports,
  loadUserComments,
  loadViews,
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
} from '@/mocks/userContent'
import { loadUsers, saveUsers } from '@/mocks/users'
import { normalizeGenreName } from '@/features/genres/api'
import type { Page } from '@/types/page'
import type { CuratedList, Genre } from '@/types/story'
import {
  ADMIN_PAGE_SIZE,
  AdminError,
  CURATED_LIMITS,
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
} from './shared'

const SYSTEM_AUTHOR = 'Hệ thống'

async function requireAdmin() {
  const user = await requireUser()
  if (!user.isAdmin) throw new AdminError()
  return user
}

const matches = (q: string, ...fields: string[]) => !q || fields.some((f) => slugify(f).includes(q))

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

export async function getAdminUsers({ q = '', page }: AdminUserQuery): Promise<Page<AdminUser>> {
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
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  return paginate(users, page, ADMIN_PAGE_SIZE)
}

export async function getAdminStories({
  q = '',
  visibility,
  ownerId,
  sort = 'updated',
  page,
}: AdminStoryQuery): Promise<Page<AdminStory>> {
  await delay()
  await requireAdmin()
  const query = slugify(q)
  const key = (s: AdminStory) =>
    sort === 'views' ? s.views : sort === 'created' ? s.createdAt : s.updatedAt
  const stories = allStories()
    .filter(
      (s) =>
        matches(query, s.title, s.ownerName) &&
        (!visibility || s.visibility === visibility) &&
        (!ownerId || s.ownerId === ownerId),
    )
    .sort((a, b) => {
      const ka = key(a)
      const kb = key(b)
      if (typeof ka === 'number' && typeof kb === 'number') {
        return kb - ka || b.updatedAt.localeCompare(a.updatedAt)
      }
      return String(kb).localeCompare(String(ka))
    })
  return paginate(stories, page, ADMIN_PAGE_SIZE)
}

// ── Hộp thư & báo lỗi ───────────────────────────────────────────────────

export async function getAdminMessages({
  status,
  page,
}: AdminMessageQuery): Promise<Page<AdminContactMessage>> {
  await delay()
  await requireAdmin()
  const messages = loadContactMessages()
    .filter((m) => status === 'all' || (status === 'open') === !m.handledAt)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .map(({ sentAt, ...m }) => ({ ...m, createdAt: sentAt }))
  return paginate(messages, page, ADMIN_PAGE_SIZE)
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
  page,
}: AdminReportQuery): Promise<Page<AdminReport>> {
  await delay()
  await requireAdmin()
  const reports = loadReports()
    .filter((r) => status === 'all' || r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((r): AdminReport[] => {
      const target = reportTarget(r.storySlug, r.chapterNumber)
      if (!target) return []
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
          reporter: r.reporter,
          createdAt: r.createdAt,
        },
      ]
    })
  return paginate(reports, page, ADMIN_PAGE_SIZE)
}

export async function setAdminReportStatus(id: string, status: AdminReport['status']) {
  await delay()
  await requireAdmin()
  saveReports(loadReports().map((r) => (r.id === id ? { ...r, status } : r)))
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
            }
          : { ...s, takedown: null },
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
