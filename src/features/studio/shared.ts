// Phần dùng chung của hai backend khu Sáng tác (api.mock.ts, api.remote.ts)
import type { StoryStatus, StoryVisibility } from '@/types/story'

export type StudioErrorCode =
  | 'not_found'
  | 'no_published_chapters'
  | 'last_published_chapter'
  | 'chapter_exists'
  | 'chapter_number_locked'
  | 'too_many_genres'
  | 'report_already_open'
  | 'story_taken_down'
  | 'story_limit'
  | 'chapter_limit'

/** Hạn mức mỗi ngày của tác giả (trigger charge_author của DB; quản trị viên không bị giới hạn) */
export const STORIES_PER_DAY = 10
export const CHAPTERS_PER_DAY = 500
export const CONTENT_BYTES_PER_DAY = 10_000_000

const messages: Record<StudioErrorCode, string> = {
  not_found: 'Không tìm thấy truyện này trong khu Sáng tác của bạn.',
  no_published_chapters: 'Cần xuất bản ít nhất 1 chương trước khi xuất bản truyện.',
  last_published_chapter:
    'Đây là chương công khai cuối cùng. Ẩn truyện trước rồi mới ẩn hoặc xóa chương này.',
  chapter_exists: 'Truyện đã có chương mang số này. Chọn số khác.',
  chapter_number_locked:
    'Chương đã xuất bản giữ nguyên số để link và lịch sử đọc của người đọc không bị hỏng.',
  too_many_genres: 'Chọn tối đa 5 thể loại.',
  story_taken_down:
    'Truyện đã bị ban quản trị gỡ nên chưa xuất bản lại được. Liên hệ ban quản trị nếu bạn cho rằng đây là nhầm lẫn.',
  story_limit: `Mỗi ngày chỉ tạo được tối đa ${STORIES_PER_DAY} truyện mới. Thử lại vào ngày mai nhé.`,
  chapter_limit: `Hôm nay bạn đã đăng hoặc sửa quá nhiều chương (tối đa ${CHAPTERS_PER_DAY} chương mới và khoảng ${CONTENT_BYTES_PER_DAY / 1_000_000} MB nội dung mỗi ngày). Thử lại vào ngày mai nhé.`,
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
  /** true: xuất bản chương đó và công khai truyện luôn; false: cả hai là nháp */
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
