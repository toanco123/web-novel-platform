// Phần dùng chung của hai backend trang quản trị (api.mock.ts, api.remote.ts)
import type { ContactTopic } from '@/features/feedback/schemas'
import type { ReportReason, ReportStatus } from '@/types/report'
import type { CuratedList, StoryStatus, StoryVisibility } from '@/types/story'

export const ADMIN_PAGE_SIZE = 20

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
    unhandledMessages: number
    bannedUsers: number
  }
  /** Mỗi ngày trong kỳ (cũ trước), day dạng 2026-09-25 */
  days: { day: string; signups: number; views: number; stories: number; chapters: number }[]
  /** Số truyện công khai theo thể loại, nhiều trước (tối đa 10) */
  genres: { name: string; stories: number }[]
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
}

export type StoryTakedown = { at: string; reason: string }

export type AdminStorySort = 'updated' | 'views' | 'created'

export type AdminUserQuery = { q?: string; page: number }

export type AdminStoryQuery = {
  q?: string
  visibility?: StoryVisibility
  ownerId?: string
  sort?: AdminStorySort
  page: number
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

export type AdminMessageQuery = { status: AdminMessageStatus; page: number }
export type AdminReportQuery = { status: ReportStatus | 'all'; page: number }

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
