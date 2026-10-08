// Phần dùng chung của hai backend khu Sáng tác (api.mock.ts, api.remote.ts)
import type { StoryReview, StoryStatus, StoryVisibility } from '@/types/story'

export type StudioErrorCode =
  | 'not_found'
  | 'no_published_chapters'
  | 'last_published_chapter'
  | 'chapter_exists'
  | 'chapter_number_locked'
  | 'too_many_genres'
  | 'report_already_open'
  | 'story_taken_down'
  | 'story_not_approved'
  | 'already_pending'
  | 'already_approved'
  | 'story_limit'
  | 'chapter_limit'
  | 'invalid_schedule'

/** Hạn mức mỗi ngày của tác giả (trigger charge_author của DB; quản trị viên không bị giới hạn) */
export const STORIES_PER_DAY = 10
export const CHAPTERS_PER_DAY = 500
export const CONTENT_BYTES_PER_DAY = 10_000_000

const messages: Record<StudioErrorCode, string> = {
  not_found: 'Không tìm thấy truyện này trong khu Sáng tác của bạn.',
  no_published_chapters: 'Cần xuất bản ít nhất 1 chương trước khi xuất bản truyện.',
  last_published_chapter:
    'Truyện đang công khai hoặc đang chờ duyệt cần ít nhất 1 chương đã xuất bản. Ẩn truyện trước (truyện chờ duyệt thì đợi duyệt xong) rồi mới ẩn hoặc xóa chương này.',
  chapter_exists: 'Truyện đã có chương mang số này. Chọn số khác.',
  chapter_number_locked:
    'Chương đã xuất bản giữ nguyên số để link và lịch sử đọc của người đọc không bị hỏng.',
  too_many_genres: 'Chọn tối đa 5 thể loại.',
  story_taken_down:
    'Truyện đã bị ban quản trị gỡ nên chưa xuất bản lại được. Liên hệ ban quản trị nếu bạn cho rằng đây là nhầm lẫn.',
  story_not_approved:
    'Truyện cần được ban quản trị duyệt trước khi công khai. Bấm "Gửi duyệt" để gửi truyện cho ban quản trị.',
  already_pending: 'Truyện đang chờ ban quản trị duyệt.',
  already_approved: 'Truyện đã được duyệt, bạn tự xuất bản được.',
  story_limit: `Mỗi ngày chỉ tạo được tối đa ${STORIES_PER_DAY} truyện mới. Thử lại vào ngày mai nhé.`,
  chapter_limit: `Hôm nay bạn đã đăng hoặc sửa quá nhiều chương (tối đa ${CHAPTERS_PER_DAY} chương mới và khoảng ${CONTENT_BYTES_PER_DAY / 1_000_000} MB nội dung mỗi ngày). Thử lại vào ngày mai nhé.`,
  invalid_schedule:
    'Giờ hẹn phải sau ít nhất 1 phút và trong vòng 365 ngày, và chỉ hẹn được chương chưa xuất bản.',
  report_already_open:
    'Bạn đọc này đã gửi lại đúng báo lỗi này và báo lỗi mới vẫn chưa xử lý, nên không mở lại báo lỗi cũ được.',
}

export const isStudioErrorCode = (code: string): code is StudioErrorCode =>
  Object.hasOwn(messages, code)

export class StudioError extends Error {
  code: StudioErrorCode
  constructor(code: StudioErrorCode) {
    super(messages[code])
    this.name = 'StudioError'
    this.code = code
  }
}

export type StoryInput = {
  title: string
  description: string
  genreSlugs: string[]
  status: StoryStatus
  coverUrl: string | null
  /** Bút danh / tác giả gốc; trống: hiển thị tên tài khoản */
  authorName?: string | null
}

export type ChapterInput = { title: string; content: string }

export type FirstChapterInput = {
  /** number: số của chương đầu tiên (mặc định 1, vd truyện đăng tiếp từ nơi khác bắt đầu từ 50) */
  chapter: ChapterInput & { number?: number }
  /** true: xuất bản chương đó; tác giả thì gửi duyệt truyện luôn, quản trị viên thì công khai luôn */
  publish: boolean
}

export type MyStory = {
  id: string
  slug: string
  title: string
  description: string
  genreSlugs: string[]
  status: StoryStatus
  coverUrl: string | null
  owner: { id: string; displayName: string }
  visibility: StoryVisibility
  createdAt: string
  /** Lần sửa gần nhất, kể cả sửa chương (sắp xếp danh sách Sáng tác) */
  updatedAt: string
  /** Lần đầu xuất bản (dùng cho "Truyện mới ra") */
  publishedAt: string | null
  /** Mọi chương, kể cả nháp */
  chapterCount: number
  publishedCount: number
  draftCount: number
  views: number
  followers: number
  /** Báo lỗi chương chưa xử lý */
  openReports: number
  /** Bị ban quản trị gỡ: truyện về nháp, không tự xuất bản lại được; null: bình thường */
  takedown: { at: string; reason: string } | null
  /** Trạng thái duyệt; null: chưa gửi duyệt lần nào (hoặc bị gỡ) */
  review: StoryReview | null
  /** Bút danh / tác giả gốc; null: dùng tên tài khoản */
  authorName: string | null
}

export const STATS_DAYS = 7

export type StoryStats = {
  views: number
  viewsRecent: number
  /** Lượt đọc từng ngày trong STATS_DAYS ngày gần nhất, cũ trước (day: YYYY-MM-DD) */
  viewsByDay: { day: string; views: number }[]
  /** Lượt đọc từng chương đã xuất bản, theo thứ tự chương */
  viewsByChapter: { number: number; title: string; views: number }[]
  followers: number
  ratingAvg: number
  ratingCount: number
  comments: number
  /** Phiếu đề cử: tổng mọi lúc và 7 ngày gần nhất */
  votes: { total: number; week: number }
}

/** Tên gọn khoảng trắng, bỏ thể loại chọn trùng */
export function normalizeStoryInput(input: StoryInput) {
  return {
    title: input.title.trim().replace(/\s+/g, ' '),
    description: input.description.trim(),
    genreSlugs: [...new Set(input.genreSlugs)],
    status: input.status,
    coverUrl: input.coverUrl,
    authorName: input.authorName?.trim().replace(/\s+/g, ' ') || null,
  }
}

// ── Hẹn giờ đăng chương ─────────────────────────────────────────────────

/** Giờ hẹn phải sau hiện tại ít nhất chừng này (như trigger chapters_before_change của DB) */
export const SCHEDULE_MIN_LEAD_MS = 60_000
/** Hẹn xa nhất 365 ngày */
export const SCHEDULE_MAX_AHEAD_MS = 365 * 24 * 60 * 60_000

/** Giờ hẹn hợp lệ thì null; quá gần (hoặc đã qua) / quá xa */
export function scheduleProblem(scheduledAt: string, now = Date.now()) {
  const time = new Date(scheduledAt).getTime()
  if (!(time >= now + SCHEDULE_MIN_LEAD_MS)) return 'too_soon' as const
  if (time > now + SCHEDULE_MAX_AHEAD_MS) return 'too_late' as const
  return null
}

/** Lời báo cho người dùng theo kết quả của scheduleProblem (missing: chưa chọn đủ ngày giờ) */
export const scheduleProblemMessage = {
  missing: 'Chọn ngày và giờ đăng.',
  too_soon: 'Chọn giờ sau hiện tại ít nhất 1 phút.',
  too_late: 'Chỉ hẹn được trong vòng 365 ngày.',
} as const

/** Nhịp của công cụ Xếp lịch */
export type ScheduleRule = {
  /** Ngày bắt đầu, `YYYY-MM-DD` (giờ của máy) */
  start: string
  /** Giờ đăng, `HH:mm` */
  time: string
  /** Các thứ được đăng: 0 = Chủ nhật, 1 = thứ Hai … 6 = thứ Bảy */
  weekdays: number[]
  /** Số chương mỗi lần đăng (1–3) */
  perSlot: number
}

export type ScheduledChapter = { number: number; scheduledAt: string }

/**
 * Xếp giờ hẹn cho các chương `numbers` (theo đúng thứ tự truyền vào): lần đăng đầu là ngày ≥
 * `start` đúng thứ đã chọn, lúc `time`; giờ đó đã qua (hoặc chưa đủ 1 phút) thì sang lần kế tiếp.
 * Mỗi lần đăng `perSlot` chương, cùng một giờ. Không chọn thứ nào thì trả mảng rỗng.
 */
export function planSchedule(
  numbers: number[],
  { start, time, weekdays, perSlot }: ScheduleRule,
  now = Date.now(),
): ScheduledChapter[] {
  const [year, month, day] = start.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const plan: ScheduledChapter[] = []
  if (!weekdays.length || perSlot < 1) return plan
  // Tối đa ~2 năm ngày để không lặp vô hạn khi dữ liệu lạ
  for (let offset = 0; plan.length < numbers.length && offset < 800; offset++) {
    // Dựng lại theo ngày (không cộng mili giây) để đúng giờ cả khi đổi giờ mùa hè
    const slot = new Date(year, month - 1, day + offset, hour, minute)
    if (!weekdays.includes(slot.getDay()) || slot.getTime() < now + SCHEDULE_MIN_LEAD_MS) continue
    for (let i = 0; i < perSlot && plan.length < numbers.length; i++) {
      plan.push({ number: numbers[plan.length], scheduledAt: slot.toISOString() })
    }
  }
  return plan
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO → giá trị ô `type="date"` và `type="time"` (giờ của máy) */
export function toLocalInputs(iso: string) {
  const d = new Date(iso)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** Ô ngày + ô giờ (giờ của máy) → ISO; thiếu ô nào thì null */
export function fromLocalInputs(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute).toISOString()
}
