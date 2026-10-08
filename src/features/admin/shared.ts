// Phần dùng chung của hai backend trang quản trị (api.mock.ts, api.remote.ts)
import type { ContactTopic } from '@/features/feedback/schemas'
import type { CommentReportReason } from '@/types/comment'
import type { ReportReason, ReportStatus } from '@/types/report'
import type { CuratedList, StoryReview, StoryStatus, StoryVisibility } from '@/types/story'

/** Số dòng mỗi trang mặc định của các bảng quản trị */
export const ADMIN_PAGE_SIZE = 20
/** Các lựa chọn số dòng mỗi trang */
export const ADMIN_PAGE_SIZES = [10, 20, 50, 100]

/** Số dòng mỗi trang hợp lệ; giá trị khác (vd ?size= sửa tay) thì dùng mặc định */
export const adminPageSize = (size?: number | null) =>
  size && ADMIN_PAGE_SIZES.includes(size) ? size : ADMIN_PAGE_SIZE

export type SortOrder = 'asc' | 'desc'

/** Kỳ thống kê của trang Tổng quan (số ngày, tính cả hôm nay) */
export const ADMIN_PERIODS = [7, 30, 90] as const
export type AdminPeriod = (typeof ADMIN_PERIODS)[number]

export type AdminOverview = {
  totals: {
    users: number
    /** Tài khoản tạo trong kỳ */
    newUsers: number
    publishedStories: number
    draftStories: number
    publishedChapters: number
    views: number
    viewsInPeriod: number
    comments: number
    openReports: number
    /** Số bình luận đang có báo cáo chưa xử lý */
    reportedComments: number
    unhandledMessages: number
    bannedUsers: number
    /** Số truyện đang chờ duyệt */
    pendingReviews: number
  }
  /** Mỗi ngày trong kỳ (cũ trước), day dạng 2026-09-25 */
  days: AdminOverviewDay[]
  /** Tổng trong kỳ đang xem (tính cả hôm nay, chưa hết ngày) */
  current: AdminPeriodTotals
  /** Tổng của kỳ liền trước, cùng số ngày */
  previous: AdminPeriodTotals
  /** Lượt đọc từng ngày cho lịch nhiệt: từ thứ Hai 11 tuần trước tới hôm nay, không theo kỳ */
  calendar: { day: string; views: number }[]
  /** Số truyện công khai theo thể loại, nhiều trước (tối đa 10) */
  genres: { name: string; stories: number }[]
  /**
   * Lượt đọc trong kỳ theo thể loại, nhiều trước (tối đa 10). Truyện nhiều thể loại tính vào từng
   * thể loại, nên tổng các mục lớn hơn tổng lượt đọc
   */
  genreViews: { name: string; views: number }[]
  /** Tác giả nhiều lượt đọc nhất trong kỳ (tối đa 10); một chủ truyện có thể có nhiều bút danh */
  topAuthors: {
    /** Khóa ổn định: chủ truyện + bút danh */
    key: string
    /** null: truyện có sẵn của hệ thống (chỉ ở bản giả) */
    ownerId: string | null
    /** Bút danh, không có thì tên tài khoản */
    name: string
    /** Số truyện đang công khai */
    stories: number
    /** Lượt đọc trong kỳ */
    views: number
    /** Tổng lượt theo dõi các truyện */
    followers: number
  }[]
  /** Truyện nhiều lượt đọc nhất (tối đa 10, chỉ truyện đã có lượt đọc) */
  topStories: {
    id: string
    slug: string
    title: string
    visibility: StoryVisibility
    authorName: string
    views: number
    followers: number
    ratingAvg: number
    ratingCount: number
  }[]
}

export type AdminOverviewDay = {
  day: string
  signups: number
  views: number
  stories: number
  chapters: number
  comments: number
  follows: number
  /** Lượt đọc của ngày tương ứng ở kỳ trước (lùi đúng số ngày của kỳ) */
  viewsPrev: number
}

export type AdminPeriodTotals = {
  signups: number
  views: number
  stories: number
  chapters: number
  comments: number
  follows: number
}

export type AdminUser = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  /** email, google, facebook... */
  provider: string
  isAdmin: boolean
  /** null: dữ liệu giả cũ không có mốc */
  createdAt: string | null
  lastSignInAt: string | null
  storyCount: number
  commentCount: number
  followCount: number
  /** Bị khóa: không đăng nhập được */
  isBanned: boolean
}

export type AdminStory = {
  id: string
  slug: string
  title: string
  /** null: truyện có sẵn của hệ thống (chỉ ở bản giả) */
  ownerId: string | null
  ownerName: string
  visibility: StoryVisibility
  status: StoryStatus
  /** Số chương đã xuất bản */
  publishedCount: number
  /** Tổng số chương, kể cả nháp */
  chapterCount: number
  views: number
  followers: number
  ratingAvg: number
  ratingCount: number
  comments: number
  openReports: number
  createdAt: string
  updatedAt: string
  /** Bị admin gỡ (về nháp, tác giả không tự công khai lại được); null: bình thường */
  takedown: StoryTakedown | null
  /** Trạng thái duyệt; truyện có sẵn của bản giả luôn là đã duyệt */
  review: StoryReview | null
  /** Bút danh; null: hiển thị tên tài khoản */
  authorName: string | null
  genreSlugs: string[]
}

export type StoryTakedown = { at: string; reason: string }

/** Độ dài tối đa của lý do từ chối (cột stories.review_reason) */
export const REVIEW_REASON_MAX = 500

export type ReviewInput = {
  storyId: string
  /** true: duyệt và công khai luôn; false: từ chối (bắt buộc lý do) */
  approve: boolean
  reason?: string | null
}

// Cột sắp xếp được của từng bảng (giá trị ?sort= trên URL). Không kèm order thì giảm dần.

export const ADMIN_USER_SORTS = [
  'name',
  'created',
  'lastSignIn',
  'stories',
  'comments',
  'follows',
] as const
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number]

export type AdminUserQuery = {
  q?: string
  /** member: tài khoản thường */
  role?: 'admin' | 'member'
  status?: 'active' | 'banned'
  /** email, google, facebook... */
  provider?: string
  /** Mặc định: created, giảm dần (mới tham gia trước) */
  sort?: AdminUserSort
  order?: SortOrder
  page: number
  pageSize?: number
}

export const ADMIN_STORY_SORTS = [
  'title',
  'chapters',
  'views',
  'followers',
  'rating',
  'comments',
  'reports',
  'created',
  'updated',
  'submitted',
] as const
export type AdminStorySort = (typeof ADMIN_STORY_SORTS)[number]

export type AdminStoryQuery = {
  q?: string
  /** takedown: truyện đang bị gỡ (cũng là nháp) */
  visibility?: StoryVisibility | 'takedown'
  status?: StoryStatus
  /** Chỉ truyện đang có báo lỗi chương chưa xử lý */
  hasReports?: boolean
  /** Trạng thái duyệt (hàng chờ /admin/reviews và bộ lọc "Duyệt" của bảng Truyện) */
  review?: 'pending' | 'rejected'
  ownerId?: string
  /** Mặc định: updated, giảm dần */
  sort?: AdminStorySort
  order?: SortOrder
  page: number
  pageSize?: number
}

/** "2026-09-25" → Date theo giờ máy (không lệch ngày do múi giờ) */
const parseDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const shortDay = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' })
const longDay = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

/** "2026-09-25" → "25/9" (nhãn trục biểu đồ) */
export const formatShortDay = (day: string) => shortDay.format(parseDay(day))
/** "2026-09-25" → "Thứ Sáu, 25/9/2026" */
export const formatLongDay = (day: string) => longDay.format(parseDay(day))

/** Dịch ngày "2026-09-25" thêm `n` ngày (âm: lùi lại) */
export function addDays(day: string, n: number) {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Thay đổi so với kỳ trước. none: cả hai bằng 0; new: kỳ trước bằng 0; flat: lệch dưới 0,5% */
export type PeriodDelta =
  | { kind: 'none' }
  | { kind: 'new'; diff: number }
  | { kind: 'up' | 'down' | 'flat'; diff: number; pct: number }

export function periodDelta(current: number, previous: number): PeriodDelta {
  const diff = current - previous
  if (previous === 0) return current === 0 ? { kind: 'none' } : { kind: 'new', diff }
  const pct = (diff / previous) * 100
  if (Math.abs(pct) < 0.5) return { kind: 'flat', diff, pct: 0 }
  return { kind: pct > 0 ? 'up' : 'down', diff, pct }
}

/**
 * Lịch nhiệt: chia `calendar` (bắt đầu thứ Hai) thành các cột tuần, mỗi cột 7 ô từ thứ Hai tới
 * Chủ nhật. Ngày chưa tới của tuần này là null.
 */
export function calendarWeeks<T extends { day: string }>(calendar: T[]): (T | null)[][] {
  const weeks: (T | null)[][] = []
  for (let i = 0; i < calendar.length; i += 7) {
    const week: (T | null)[] = calendar.slice(i, i + 7)
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

/** Mức đậm của ô lịch nhiệt: 0 (không có lượt nào) hoặc 1–4 theo tỉ lệ với ngày nhiều nhất */
export function heatLevel(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0
  return Math.min(4, Math.ceil((value / max) * 4))
}

// ── Hộp thư & báo lỗi ───────────────────────────────────────────────────

/** Lọc hộp thư: chưa xử lý | đã xử lý | tất cả */
export type AdminMessageStatus = 'open' | 'handled' | 'all'

export type AdminContactMessage = {
  id: string
  name: string
  email: string
  topic: ContactTopic
  message: string
  createdAt: string
  /** null: chưa xử lý */
  handledAt: string | null
}

export type AdminReport = {
  id: string
  storySlug: string
  storyTitle: string
  /** Truyện đang công khai (có link sang trang đọc) */
  storyPublished: boolean
  chapterNumber: number
  chapterTitle: string
  reason: ReportReason
  note: string
  status: ReportStatus
  reporter: { id: string; displayName: string }
  createdAt: string
}

export type AdminComment = {
  id: string
  content: string
  createdAt: string
  /** Lần sửa nội dung gần nhất; null: chưa sửa */
  editedAt: string | null
  /** Là trả lời của một bình luận khác */
  isReply: boolean
  /** Số trả lời sẽ bị xóa theo nếu xóa bình luận này */
  replyCount: number
  author: { id: string; displayName: string }
  storySlug: string
  storyTitle: string
  /** Truyện đang công khai (có link sang trang truyện / trang đọc) */
  storyPublished: boolean
  /** null: bình luận của cả truyện */
  chapterNumber: number | null
  /** Các báo cáo chưa xử lý, mới nhất trước */
  reports: {
    reason: CommentReportReason
    note: string
    reporterName: string
    createdAt: string
    /** Nội dung bình luận lúc bị báo cáo; null: báo cáo cũ, chưa lưu */
    contentSnapshot: string | null
  }[]
}

export const ADMIN_COMMENT_SORTS = ['created', 'reported'] as const
export type AdminCommentSort = (typeof ADMIN_COMMENT_SORTS)[number]

export type AdminCommentQuery = {
  /** reported: chỉ bình luận có báo cáo chưa xử lý; all: mọi bình luận */
  view: 'reported' | 'all'
  q?: string
  /** root: bình luận gốc; reply: trả lời */
  kind?: 'root' | 'reply'
  /** created: lúc viết; reported: lúc bị báo cáo gần nhất. Mặc định: reported khi view = reported */
  sort?: AdminCommentSort
  order?: SortOrder
  page: number
  pageSize?: number
}

export type AdminMessageQuery = {
  status: AdminMessageStatus
  topic?: ContactTopic
  /** Tìm không dấu theo tên, email, nội dung */
  q?: string
  /** Theo lúc gửi; mặc định giảm dần (mới trước) */
  order?: SortOrder
  page: number
  pageSize?: number
}

export type AdminReportQuery = {
  status: ReportStatus | 'all'
  reason?: ReportReason
  /** Tìm không dấu theo tên truyện, ghi chú, người báo */
  q?: string
  /** Theo lúc báo; mặc định giảm dần (mới trước) */
  order?: SortOrder
  page: number
  pageSize?: number
}

// ── Truyện chọn tay trên trang chủ ──────────────────────────────────────

/** Số truyện tối đa của mỗi danh sách chọn tay */
export const CURATED_LIMITS: Record<CuratedList, number> = { featured: 8, editor_pick: 12 }

export type CuratedStory = {
  id: string
  slug: string
  title: string
  authorName: string
  /** false: truyện đang ẩn hoặc bị gỡ, không lên trang chủ cho tới khi công khai lại */
  isPublic: boolean
}

export type AdminErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'cannot_ban_self'
  | 'cannot_ban_admin'
  | 'genre_exists'
  | 'same_genre'
  | 'builtin_genre'
  | 'too_many_curated'
  | 'not_pending'
  | 'reason_required'

const adminMessages: Record<AdminErrorCode, string> = {
  forbidden: 'Chỉ quản trị viên mới xem được trang này.',
  not_found: 'Không tìm thấy mục này. Có thể nó vừa bị xóa.',
  cannot_ban_self: 'Bạn không thể tự khóa tài khoản của mình.',
  cannot_ban_admin: 'Không khóa được tài khoản quản trị viên khác.',
  genre_exists: 'Đã có thể loại khác trùng tên này. Dùng "Gộp" nếu muốn nhập hai thể loại làm một.',
  same_genre: 'Chọn một thể loại khác để gộp vào.',
  builtin_genre:
    'Bản thử nghiệm không sửa được thể loại có sẵn, chỉ sửa được thể loại do người dùng tạo.',
  too_many_curated: 'Danh sách này đã đủ số truyện. Bỏ bớt một truyện rồi thêm lại.',
  not_pending:
    'Truyện này không còn chờ duyệt. Có thể quản trị viên khác vừa xử lý hoặc truyện vừa bị gỡ.',
  reason_required: 'Nhập lý do từ chối để tác giả biết cần sửa gì.',
}

export const isAdminErrorCode = (code: string): code is AdminErrorCode =>
  Object.hasOwn(adminMessages, code)

export class AdminError extends Error {
  code: AdminErrorCode
  constructor(code: AdminErrorCode = 'forbidden') {
    super(adminMessages[code])
    this.name = 'AdminError'
    this.code = code
  }
}

/** Lời báo cho thao tác admin thất bại */
export const adminErrorMessage = (error: unknown) =>
  error instanceof AdminError ? error.message : 'Chưa lưu được. Kiểm tra mạng rồi thử lại.'
