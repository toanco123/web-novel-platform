// Chỗ đọc chưa gửi được lên máy chủ vì mất mạng (người đã đăng nhập, bản Supabase): lưu trên máy,
// có mạng lại thì OfflineSync gửi lên. Mỗi tài khoản một hàng chờ, mỗi truyện giữ lần ghi mới nhất.
import { readMock, writeMock } from '@/lib/mockStorage'
import type { ReadingProgress } from '@/types/library'
import type { ProgressInput } from './shared'

const KEY = 'reading-progress-pending'

export type PendingProgress = ProgressInput & { readAt: string }
type Queue = Record<string, Record<string, PendingProgress>>

function load(): Queue {
  const queue = readMock<unknown>(KEY, {})
  return queue && typeof queue === 'object' && !Array.isArray(queue) ? (queue as Queue) : {}
}

function save(queue: Queue) {
  const users = Object.entries(queue).filter(([, entries]) => Object.keys(entries).length > 0)
  writeMock(KEY, users.length ? Object.fromEntries(users) : null)
}

/**
 * Thêm lần ghi vào hàng chờ và trả về chỗ đọc như khi ghi thành công. Mở chương (progress bỏ
 * trống) mà vẫn là chương đang chờ thì giữ vị trí cũ, như RPC save_reading_progress.
 */
export function queueProgress(userId: string, input: ProgressInput): ReadingProgress {
  const queue = load()
  const mine = queue[userId] ?? {}
  const old = mine[input.slug]
  const progress = input.progress ?? (old?.chapter === input.chapter ? old.progress : undefined)
  const entry: PendingProgress = { ...input, progress, readAt: new Date().toISOString() }
  save({ ...queue, [userId]: { ...mine, [input.slug]: entry } })
  return {
    slug: input.slug,
    chapter: input.chapter,
    chapterTitle: input.chapterTitle,
    progress: Math.min(1, Math.max(0, progress ?? 0)),
    readAt: entry.readAt,
  }
}

/** Hàng chờ của một tài khoản, cũ nhất trước */
export function pendingProgress(userId: string): PendingProgress[] {
  return Object.values(load()[userId] ?? {}).sort((a, b) => a.readAt.localeCompare(b.readAt))
}

/** Bỏ mục của truyện `slug`; có `readAt` thì chỉ bỏ khi mục chưa bị thay bằng lần ghi mới hơn */
export function dropPending(userId: string, slug: string, readAt?: string) {
  const queue = load()
  const entry = queue[userId]?.[slug]
  if (!entry || (readAt !== undefined && entry.readAt !== readAt)) return
  const { [slug]: _dropped, ...rest } = queue[userId]
  save({ ...queue, [userId]: rest })
}
