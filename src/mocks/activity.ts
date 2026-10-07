// Hoạt động của người đọc (theo dõi, lịch sử đọc, lượt đọc, chấm điểm, bình luận, chặn, báo lỗi,
// điểm danh và phiếu đề cử),
// lưu localStorage trong giai đoạn mock. Nhiều api.ts cùng đọc các dữ liệu này (vd studio đếm
// người theo dõi), nên gom về một chỗ thay vì để api này đọc thẳng key của api khác.
import { readMock, writeMock } from '@/lib/mockStorage'
import type { Comment, CommentReportReason, Score } from '@/types/comment'
import type { ReadingProgress } from '@/types/library'
import type { ContactTopic } from '@/features/feedback/schemas'
import type { ChapterReport, ReportStatus } from '@/types/report'

const FOLLOWS_KEY = 'mock-library'
const HISTORY_KEY = 'mock-history'
const VIEWS_KEY = 'mock-views'
const RATINGS_KEY = 'mock-ratings'
const COMMENTS_KEY = 'mock-comments'
const COMMENT_REPORTS_KEY = 'mock-comment-reports'
const REPORTS_KEY = 'mock-reports'
const CONTACT_KEY = 'mock-contact-messages'
const BLOCKS_KEY = 'mock-user-blocks'
const CHECKINS_KEY = 'mock-checkins'
const LEDGER_KEY = 'mock-ticket-ledger'
const VOTES_KEY = 'mock-story-votes'

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

// Bình luận lưu trước khi có bình luận theo chương không có chapterNumber, trước khi có trả lời
// không có parentId. replyCount không lưu: api đếm lại khi đọc
export const loadUserComments = () =>
  readMock<Comment[]>(COMMENTS_KEY, []).map((c) => ({
    ...c,
    chapterNumber: c.chapterNumber ?? null,
    parentId: c.parentId ?? null,
    replyCount: 0,
  }))
export const saveUserComments = (comments: Comment[]) => writeMock(COMMENTS_KEY, comments)

/** Báo cáo bình luận vi phạm (chỉ quản trị viên xem) */
export type StoredCommentReport = {
  id: string
  commentId: string
  reporter: { id: string; displayName: string }
  reason: CommentReportReason
  note: string
  status: ReportStatus
  createdAt: string
}

export const loadCommentReports = () => readMock<StoredCommentReport[]>(COMMENT_REPORTS_KEY, [])
export const saveCommentReports = (reports: StoredCommentReport[]) =>
  writeMock(COMMENT_REPORTS_KEY, reports)

/**
 * Xóa các bình luận khớp điều kiện, kèm trả lời và báo cáo của chúng (như khóa ngoại cascade trên
 * DB). Trả về số bình luận khớp điều kiện.
 */
export function removeComments(match: (comment: Comment) => boolean) {
  const all = loadUserComments()
  const matched = all.filter(match)
  const removed = new Set(matched.map((c) => c.id))
  for (const c of all) if (c.parentId && removed.has(c.parentId)) removed.add(c.id)
  saveUserComments(all.filter((c) => !removed.has(c.id)))
  saveCommentReports(loadCommentReports().filter((r) => !removed.has(r.commentId)))
  return matched.length
}

// ── Chặn người dùng ─────────────────────────────────────────────────────

export type BlockEntry = { userId: string; blockedAt: string }

/** userId → người đã chặn (chặn gần nhất trước) */
export const loadAllBlocks = () => readMock<Record<string, BlockEntry[]>>(BLOCKS_KEY, {})

export const loadBlocks = (userId: string) => loadAllBlocks()[userId] ?? []

export function saveBlocks(userId: string, entries: BlockEntry[]) {
  const { [userId]: _old, ...rest } = loadAllBlocks()
  writeMock(BLOCKS_KEY, entries.length ? { ...rest, [userId]: entries } : rest)
}

/** Người `viewerId` đã chặn, bình luận của họ bị ẩn (như private.my_blocked_ids()); khách: rỗng */
export const blockedIds = (viewerId: string | null) =>
  new Set(viewerId ? loadBlocks(viewerId).map((e) => e.userId) : [])

// ── Báo lỗi chương ──────────────────────────────────────────────────────

export const loadReports = () => readMock<ChapterReport[]>(REPORTS_KEY, [])
export const saveReports = (reports: ChapterReport[]) => writeMock(REPORTS_KEY, reports)

// ── Tin nhắn liên hệ ────────────────────────────────────────────────────

export type StoredContactMessage = {
  id: string
  name: string
  email: string
  topic: ContactTopic
  message: string
  sentAt: string
  /** Lúc quản trị viên đánh dấu đã xử lý; null: chưa xử lý */
  handledAt: string | null
}

// Dữ liệu cũ không có id và handledAt
export const loadContactMessages = () =>
  readMock<(Omit<StoredContactMessage, 'id' | 'handledAt'> & Partial<StoredContactMessage>)[]>(
    CONTACT_KEY,
    [],
  ).map((m, i): StoredContactMessage => ({
    ...m,
    id: m.id ?? `cu-${i}`,
    handledAt: m.handledAt ?? null,
  }))
export const saveContactMessages = (messages: StoredContactMessage[]) =>
  writeMock(CONTACT_KEY, messages)

// ── Điểm danh và phiếu đề cử (features/rewards) ─────────────────────────

export type CheckinEntry = {
  /** Ngày theo giờ Việt Nam (YYYY-MM-DD) */
  day: string
  streak: number
  reward: number
}

/** Lần điểm danh của một người, mới nhất trước */
export const loadCheckins = (userId: string) =>
  readMock<Record<string, CheckinEntry[]>>(CHECKINS_KEY, {})[userId] ?? []
export const saveCheckins = (userId: string, entries: CheckinEntry[]) =>
  writeMock(CHECKINS_KEY, { ...readMock(CHECKINS_KEY, {}), [userId]: entries })

export type StoredLedgerEntry = {
  id: string
  amount: number
  reason: 'checkin' | 'vote'
  storySlug: string | null
  balanceAfter: number
  createdAt: string
}

/** Sổ phiếu của một người, mới nhất trước */
export const loadLedger = (userId: string) =>
  readMock<Record<string, StoredLedgerEntry[]>>(LEDGER_KEY, {})[userId] ?? []
export const saveLedger = (userId: string, entries: StoredLedgerEntry[]) =>
  writeMock(LEDGER_KEY, { ...readMock(LEDGER_KEY, {}), [userId]: entries })

export type StoredVote = { storySlug: string; userId: string; amount: number; createdAt: string }

/** Mọi lượt đề cử (mọi người), cũ trước */
export const loadVotes = () => readMock<StoredVote[]>(VOTES_KEY, [])
export const saveVotes = (votes: StoredVote[]) => writeMock(VOTES_KEY, votes)

/** Tổng phiếu của truyện; `days`: chỉ tính trong số ngày gần nhất */
export function storyVoteCount(slug: string, days?: number) {
  const since = days === undefined ? -Infinity : Date.now() - days * 86_400_000
  return loadVotes()
    .filter((v) => v.storySlug === slug && Date.parse(v.createdAt) > since)
    .reduce((sum, v) => sum + v.amount, 0)
}
