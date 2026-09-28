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
  loadReports,
  loadUserComments,
  loadViews,
} from '@/mocks/activity'
import { allGenres, toStory } from '@/mocks/catalog'
import { stories as seedStories } from '@/mocks/stories'
import { loadChapters, loadUserStories } from '@/mocks/userContent'
import { loadUsers } from '@/mocks/users'
import type { Page } from '@/types/page'
import {
  ADMIN_PAGE_SIZE,
  AdminError,
  type AdminOverview,
  type AdminStory,
  type AdminStoryQuery,
  type AdminUser,
  type AdminUserQuery,
} from './shared'

const SYSTEM_AUTHOR = 'Hệ thống'

async function requireAdmin() {
  const user = await requireUser()
  if (!user.isAdmin) throw new AdminError()
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
