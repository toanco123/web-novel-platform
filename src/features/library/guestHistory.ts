// Lịch sử đọc của khách chưa đăng nhập khi chạy với Supabase: chỉ lưu trên trình duyệt này, gộp
// vào tài khoản ở lần đầu đăng nhập (api.remote.ts). Bản giả giữ lịch sử khách ở
// src/mocks/activity.ts.
import { readMock, writeMock } from '@/lib/mockStorage'
import type { ReadingProgress } from '@/types/library'
import { addToHistory, HISTORY_LIMIT, type ProgressInput } from './shared'

const KEY = 'reading-history-guest'

/** Giới hạn số chương của reading_history (như CHAPTER_NUMBER_MAX của khu Sáng tác) */
const CHAPTER_MAX = 99_999

/** Dạng Date.toISOString() mà addToHistory ghi (năm 4 chữ số) */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** Ngày có thật: Postgres không nhận 30/02 (Date tự đổi thành 02/03) hay năm 0000 */
function isReadAt(value: string) {
  const time = Date.parse(value)
  return ISO_TIME.test(value) && time > 0 && new Date(time).toISOString() === value
}

// Dòng hỏng (localStorage bị sửa tay) thì bỏ ngay khi đọc: chỉ một dòng merge_guest_history không
// đọc được (số chương ngoài khoảng, ngày sai dạng...) là cả lần gộp lỗi
function isProgress(value: unknown): value is ReadingProgress {
  const p = value as Partial<ReadingProgress> | null
  return (
    typeof p?.slug === 'string' &&
    typeof p.chapter === 'number' &&
    Number.isInteger(p.chapter) &&
    p.chapter >= 1 &&
    p.chapter <= CHAPTER_MAX &&
    typeof p.chapterTitle === 'string' &&
    typeof p.progress === 'number' &&
    p.progress >= 0 &&
    p.progress <= 1 &&
    typeof p.readAt === 'string' &&
    isReadAt(p.readAt)
  )
}

/** Mới đọc trước */
export function loadGuestHistory(): ReadingProgress[] {
  const stored = readMock<unknown>(KEY, [])
  return Array.isArray(stored) ? stored.filter(isProgress).slice(0, HISTORY_LIMIT) : []
}

const save = (entries: ReadingProgress[]) => writeMock(KEY, entries.length ? entries : null)

/** Như bản giả: truyện vừa đọc lên đầu; progress bỏ trống thì giữ vị trí cũ nếu vẫn chương đó */
export function saveGuestProgress(input: ProgressInput): ReadingProgress {
  const { entry, history } = addToHistory(loadGuestHistory(), input)
  save(history)
  return entry
}

export const removeGuestHistory = (slug: string) =>
  save(loadGuestHistory().filter((p) => p.slug !== slug))

export const clearGuestHistory = () => save([])
