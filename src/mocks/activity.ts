// Hoạt động của người đọc (theo dõi, lịch sử đọc, lượt đọc, chấm điểm, bình luận, báo lỗi),
// lưu localStorage trong giai đoạn mock. Nhiều api.ts cùng đọc các dữ liệu này (vd studio đếm
// người theo dõi), nên gom về một chỗ thay vì để api này đọc thẳng key của api khác.
import { readMock, writeMock } from '@/lib/mockStorage'
import type { Comment, Score } from '@/types/comment'
import type { ReadingProgress } from '@/types/library'
import type { ChapterReport } from '@/types/report'

const FOLLOWS_KEY = 'mock-library'
const HISTORY_KEY = 'mock-history'
const VIEWS_KEY = 'mock-views'
const RATINGS_KEY = 'mock-ratings'
const COMMENTS_KEY = 'mock-comments'
const REPORTS_KEY = 'mock-reports'

/** Chủ lịch sử đọc khi chưa đăng nhập */
export const GUEST = 'guest'

// ── Theo dõi ────────────────────────────────────────────────────────────

export type FollowEntry = {
  slug: string
  followedAt: string
  /** Chương mới nhất người dùng đã thấy (lúc theo dõi hoặc đã đọc tới); null: dữ liệu cũ chưa có mốc */
  seenChapter: number | null
}

// Dữ liệu cũ chỉ lưu slug; vẫn đọc được
type StoredFollows = Record<string, (FollowEntry | string)[]>

const toEntry = (e: FollowEntry | string): FollowEntry =>
  typeof e === 'string' ? { slug: e, followedAt: new Date(0).toISOString(), seenChapter: null } : e

/** userId → truyện đang theo dõi (mới theo dõi trước) */
export function loadAllFollows(): Record<string, FollowEntry[]> {
  const stored = readMock<StoredFollows>(FOLLOWS_KEY, {})
  return Object.fromEntries(Object.entries(stored).map(([id, list]) => [id, list.map(toEntry)]))
}

export const loadFollows = (userId: string) => loadAllFollows()[userId] ?? []

export const saveFollows = (userId: string, entries: FollowEntry[]) =>
  writeMock(FOLLOWS_KEY, { ...loadAllFollows(), [userId]: entries })

export const followerCount = (slug: string) =>
  Object.values(loadAllFollows()).filter((list) => list.some((e) => e.slug === slug)).length

// ── Lịch sử đọc ─────────────────────────────────────────────────────────

type StoredHistory = Record<string, ReadingProgress[]>

/** Lịch sử của một người (userId hoặc GUEST), mới đọc trước */
export const loadHistory = (owner: string) => readMock<StoredHistory>(HISTORY_KEY, {})[owner] ?? []

export function saveHistory(owner: string, entries: ReadingProgress[]) {
  const { [owner]: _old, ...rest } = readMock<StoredHistory>(HISTORY_KEY, {})
  writeMock(HISTORY_KEY, entries.length ? { ...rest, [owner]: entries } : rest)
}

// ── Lượt đọc ────────────────────────────────────────────────────────────

export type ViewStats = {
  /** số chương → lượt đọc */
  byChapter: Record<string, number>
  /** ngày (YYYY-MM-DD, giờ máy) → lượt đọc */
  byDay: Record<string, number>
}

export const loadViews = () => readMock<Record<string, ViewStats>>(VIEWS_KEY, {})
export const saveViews = (views: Record<string, ViewStats>) => writeMock(VIEWS_KEY, views)

/** Ngày theo giờ máy, dạng 2026-09-25 */
export function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const totalViews = (stats: ViewStats | undefined) =>
  Object.values(stats?.byChapter ?? {}).reduce((a, b) => a + b, 0)

/** Lượt đọc trong `days` ngày gần nhất, tính cả hôm nay */
export function recentViews(stats: ViewStats | undefined, days: number, now = new Date()) {
  let sum = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    sum += stats?.byDay[dayKey(d)] ?? 0
  }
  return sum
}

// ── Chấm điểm ───────────────────────────────────────────────────────────

/** userId → slug → điểm */
type Ratings = Record<string, Record<string, Score>>

export const loadRatings = () => readMock<Ratings>(RATINGS_KEY, {})
export const saveRatings = (ratings: Ratings) => writeMock(RATINGS_KEY, ratings)

/** Mọi điểm người dùng đã chấm cho một truyện */
export const ratingsOf = (slug: string) =>
  Object.values(loadRatings())
    .map((byStory) => byStory[slug])
    .filter((s): s is Score => !!s)

// ── Bình luận ───────────────────────────────────────────────────────────

// Bình luận lưu trước khi có bình luận theo chương không có chapterNumber
export const loadUserComments = () =>
  readMock<Comment[]>(COMMENTS_KEY, []).map((c) => ({
    ...c,
    chapterNumber: c.chapterNumber ?? null,
  }))
export const saveUserComments = (comments: Comment[]) => writeMock(COMMENTS_KEY, comments)

// ── Báo lỗi chương ──────────────────────────────────────────────────────

export const loadReports = () => readMock<ChapterReport[]>(REPORTS_KEY, [])
export const saveReports = (reports: ChapterReport[]) => writeMock(REPORTS_KEY, reports)
