// Tủ truyện trên Supabase: theo dõi (bảng follows), lịch sử đọc (reading_history) và các RPC
// get_library, library_update_count, save_reading_progress, merge_guest_history.
// Mốc "đã thấy" của truyện đang theo dõi do trigger lo: đặt khi theo dõi, nâng khi đọc tới
// chương xa hơn. Khách chưa đăng nhập giữ lịch sử trên máy (guestHistory.ts), gộp lên ở lần đầu
// có phiên.
import type { PostgrestError } from '@supabase/supabase-js'
import { getUserId, requireUserId, unauthenticated } from '@/features/auth/api'
import {
  storiesByIds,
  storiesBySlugs,
  storyIdBySlug,
  toStory,
} from '@/features/stories/cards.remote'
import { businessCode, isUniqueViolation, unwrap } from '@/lib/dbError'
import { isNetworkError } from '@/lib/network'
import { db } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { HistoryItem, LibraryItem, ReadingProgress } from '@/types/library'
import {
  clearGuestHistory,
  loadGuestHistory,
  removeGuestHistory,
  saveGuestProgress,
} from './guestHistory'
import { dropPending, pendingProgress, queueProgress } from './pendingProgress'
import { HISTORY_LIMIT, type ProgressInput } from './shared'

type HistoryRow = Pick<
  Tables<'reading_history'>,
  'chapter_number' | 'chapter_title' | 'progress' | 'read_at'
>

const toProgress = (slug: string, row: HistoryRow): ReadingProgress => ({
  slug,
  chapter: row.chapter_number,
  chapterTitle: row.chapter_title,
  progress: row.progress,
  readAt: row.read_at,
})

/** RPC báo 'unauthenticated' (phiên hết hạn giữa chừng) → AuthError như requireUser */
const rpcError = (error: PostgrestError) =>
  businessCode(error) === 'unauthenticated' ? unauthenticated() : null

/**
 * Lỗi dữ liệu của Postgres (SQLSTATE nhóm 22: số ngoài khoảng, ngày không có thật...): gửi lại
 * bao nhiêu lần cũng lỗi. Lỗi từ cổng API (trang lỗi không phải JSON) không có code.
 */
const isDataException = (error: PostgrestError) => /^22/.test(error.code ?? '')

/**
 * Bộ lọc .in() nằm trên URL, mà URL dài quá (~8 KB) thì máy chủ từ chối cả truy vấn. Danh sách dài
 * (theo dõi vài trăm truyện) được chia thành nhiều truy vấn chạy song song, nối lại đúng thứ tự.
 */
async function inChunks<T, R>(items: T[], size: number, load: (chunk: T[]) => Promise<R[]>) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return (await Promise.all(chunks.map((chunk) => load(chunk)))).flat()
}

// Mỗi truy vấn giữ URL dưới 8 KB: id là uuid 36 ký tự, slug truyện dài tối đa 140 ký tự
const IDS_PER_QUERY = 100
const SLUGS_PER_QUERY = 50

// Ngay sau khi đăng nhập, nhiều truy vấn chạy cùng lúc (chấm trên avatar, "Đọc tiếp"...):
// chỉ gộp một lần
let merging: Promise<void> | null = null

/**
 * Gộp lịch sử lúc còn là khách vào tài khoản (mỗi truyện giữ lần đọc mới hơn), xong thì xóa bản
 * trên máy. Lỗi mạng hay phiên hết hạn thì giữ bản trên máy để lần sau gộp lại.
 */
async function mergeGuestHistory() {
  const entries = loadGuestHistory()
  if (!entries.length) return
  merging ??= (async () => {
    const { error } = await db().rpc('merge_guest_history', { p_entries: entries })
    // Lỗi dữ liệu (dòng hỏng lọt qua loadGuestHistory) thì lần gộp nào cũng lỗi, mà mọi hàm của tủ
    // truyện đều gộp trước: bỏ bản trên máy luôn thay vì chặn cả tủ truyện
    if (error && !isDataException(error)) throw rpcError(error) ?? error
    clearGuestHistory()
  })().finally(() => {
    merging = null
  })
  await merging
}

/** Người đang đăng nhập (null: khách); lần đầu có phiên thì gộp lịch sử khách lên trước */
async function historyOwner(): Promise<string | null> {
  const userId = await getUserId()
  if (userId) await mergeGuestHistory()
  return userId
}

// ── Theo dõi ────────────────────────────────────────────────────────────

export async function getFollowStatus(slug: string): Promise<boolean> {
  const userId = await requireUserId()
  const row = unwrap(
    await db()
      .from('follows')
      .select('story_id, stories!inner(slug)')
      .eq('user_id', userId)
      .eq('stories.slug', slug)
      .maybeSingle(),
  )
  return row !== null
}

/** Mốc "đã thấy" do trigger đặt: chương mới nhất lúc theo dõi, hoặc chương đã đọc tới nếu xa hơn */
export async function followStory(slug: string): Promise<boolean> {
  await requireUserId()
  const storyId = await storyIdBySlug(slug)
  if (!storyId) throw new Error('Không tìm thấy truyện này.')
  // Chỉ gửi story_id (user_id mặc định là người đang đăng nhập); đã theo dõi rồi thì thôi
  const { error } = await db().from('follows').insert({ story_id: storyId })
  if (error && !isUniqueViolation(error)) throw error
  return true
}

export async function unfollowStory(slug: string): Promise<boolean> {
  const userId = await requireUserId()
  const storyId = await storyIdBySlug(slug)
  if (storyId) {
    unwrap(await db().from('follows').delete().eq('user_id', userId).eq('story_id', storyId))
  }
  return false
}

// ── Tủ truyện ───────────────────────────────────────────────────────────

async function historyOf(userId: string, storyIds: string[]) {
  return unwrap(
    await db()
      .from('reading_history')
      .select('story_id, chapter_number, chapter_title, progress, read_at')
      .eq('user_id', userId)
      .in('story_id', storyIds),
  )
}

/**
 * Truyện đang theo dõi; truyện có chương mới lên đầu, rồi tới truyện mới cập nhật (get_library đã
 * xếp). Truyện bị gỡ hoặc tác giả ẩn đi thì RLS bỏ ra, tạm không hiện.
 */
export async function getLibrary(): Promise<LibraryItem[]> {
  const userId = await requireUserId()
  await mergeGuestHistory()
  // library_cards (bọc get_library) trả thẳng thẻ truyện: bỏ request lấy thẻ theo id
  const follows = unwrap(await db().rpc('library_cards'))
  if (!follows.length) return []
  const ids = follows.map((f) => f.story_id)
  const history = await inChunks(ids, IDS_PER_QUERY, (chunk) => historyOf(userId, chunk))
  const readById = new Map(history.map((h) => [h.story_id, h]))
  return follows.map((f) => {
    const story = toStory(f.card)
    const read = readById.get(f.story_id)
    return {
      story,
      followedAt: f.followed_at,
      newChapters: f.new_chapters,
      progress: read ? toProgress(story.slug, read) : null,
    }
  })
}

/** Số truyện đang theo dõi có chương mới (chấm đỏ ở header) */
export async function getLibraryUpdateCount(): Promise<number> {
  await requireUserId()
  // Gộp lịch sử khách trước (đọc tới chương mới cũng nâng mốc "đã thấy") để số khớp với tủ truyện
  await mergeGuestHistory()
  return unwrap(await db().rpc('library_update_count'))
}

// ── Lịch sử đọc ─────────────────────────────────────────────────────────

/** Lịch sử của khách kèm thẻ truyện; truyện không còn xem được thì bỏ qua (như bản giả) */
async function guestHistoryItems(limit: number): Promise<HistoryItem[]> {
  let history = loadGuestHistory()
  if (history.length > limit) {
    // Chỉ tải thẻ truyện cho các dòng sẽ hiện: hỏi trước truyện nào còn xem được (truy vấn nhẹ)
    const rows = await inChunks(
      history.map((p) => p.slug),
      SLUGS_PER_QUERY,
      async (slugs) => unwrap(await db().from('stories').select('slug').in('slug', slugs)),
    )
    const visible = new Set(rows.map((r) => r.slug))
    history = history.filter((p) => visible.has(p.slug))
  }
  const shown = history.slice(0, limit)
  const cards = await inChunks(
    shown.map((p) => p.slug),
    SLUGS_PER_QUERY,
    storiesBySlugs,
  )
  const stories = new Map(cards.map((s) => [s.slug, s]))
  return shown.flatMap((progress) => {
    const story = stories.get(progress.slug)
    return story ? [{ story, progress }] : []
  })
}

export async function getReadingHistory(limit = HISTORY_LIMIT): Promise<HistoryItem[]> {
  const userId = await historyOwner()
  if (!userId) return guestHistoryItems(limit)
  // stories!inner bỏ truyện không còn xem được trước khi cắt `limit` (như bản giả)
  const rows = unwrap(
    await db()
      .from('reading_history')
      .select('story_id, chapter_number, chapter_title, progress, read_at, stories!inner(slug)')
      .eq('user_id', userId)
      .order('read_at', { ascending: false })
      .limit(Math.min(limit, HISTORY_LIMIT)),
  )
  const stories = new Map((await storiesByIds(rows.map((r) => r.story_id))).map((s) => [s.id, s]))
  return rows.flatMap((row) => {
    const story = stories.get(row.story_id)
    return story ? [{ story, progress: toProgress(story.slug, row) }] : []
  })
}

/** Chỗ đọc dở của một truyện; null nếu chưa đọc */
export async function getStoryProgress(slug: string): Promise<ReadingProgress | null> {
  const userId = await historyOwner()
  if (!userId) return loadGuestHistory().find((p) => p.slug === slug) ?? null
  const row = unwrap(
    await db()
      .from('reading_history')
      .select('chapter_number, chapter_title, progress, read_at, stories!inner(slug)')
      .eq('user_id', userId)
      .eq('stories.slug', slug)
      .maybeSingle(),
  )
  return row ? toProgress(slug, row) : null
}

// Các lần ghi chạy lần lượt theo thứ tự gọi như bản giả. Chạy song song thì lần nào tới DB sau thắng:
// rời chương 5 (lưu vị trí cuộn) rồi mở ngay chương 6 có thể để lịch sử dừng lại ở chương 5
let lastSave: Promise<unknown> = Promise.resolve()

/**
 * Ghi chỗ đang đọc: gọi khi mở chương (progress bỏ trống: giữ vị trí cũ nếu cùng chương) và khi
 * cuộn. Truyện lên đầu lịch sử; nếu đang theo dõi thì trigger nâng mốc "đã thấy".
 */
export function saveReadingProgress(input: ProgressInput): Promise<ReadingProgress> {
  const save = writeProgress(input, lastSave)
  lastSave = save.catch(() => undefined)
  return save
}

async function writeProgress(input: ProgressInput, previous: Promise<unknown>) {
  // Biết chủ lịch sử ngay lúc gọi, rồi mới chờ tới lượt: đăng xuất trong lúc chờ thì lần ghi này
  // không bị tính thành lịch sử của khách
  const userId = await getUserId()
  await previous
  if (!userId) return saveGuestProgress(input)
  // Trong lúc chờ lượt đã đổi tài khoản: RPC ghi theo phiên hiện tại, nên giữ lại cho đúng người
  if ((await getUserId()) !== userId) return queueProgress(userId, input)
  try {
    await mergeGuestHistory()
    const row = unwrap(
      await db().rpc('save_reading_progress', {
        p_slug: input.slug,
        p_chapter: input.chapter,
        p_chapter_title: input.chapterTitle,
        // Bỏ trống thì RPC nhận null: giữ vị trí cũ nếu vẫn chương đó
        p_progress: input.progress,
      }),
      rpcError,
    )
    // Lần ghi này mới hơn mục đang chờ (nếu có) của truyện
    dropPending(userId, input.slug)
    return toProgress(input.slug, row)
  } catch (error) {
    // Mất mạng: giữ trên máy, có mạng lại thì syncPendingProgress gửi lên
    if (!isNetworkError(error)) throw error
    return queueProgress(userId, input)
  }
}

/**
 * Gửi các chỗ đọc ghi lúc mất mạng của người đang đăng nhập, cũ trước mới sau; trả số mục đã gửi.
 * Chạy nối đuôi các lần ghi khác (lastSave) để không ghi đè lần ghi mới hơn.
 */
export function syncPendingProgress(): Promise<number> {
  const sync = sendPending(lastSave)
  lastSave = sync.catch(() => undefined)
  return sync
}

async function sendPending(previous: Promise<unknown>) {
  const userId = await getUserId()
  await previous
  if (!userId) return 0
  let sent = 0
  for (const entry of pendingProgress(userId)) {
    // RPC ghi theo phiên hiện tại: đổi tài khoản giữa chừng thì dừng, để dành cho đúng người
    if ((await getUserId()) !== userId) break
    const { error } = await db().rpc('save_reading_progress', {
      p_slug: entry.slug,
      p_chapter: entry.chapter,
      p_chapter_title: entry.chapterTitle,
      p_progress: entry.progress,
    })
    // Mất mạng hay phiên hết hạn: để lần sau
    if (error && (isNetworkError(error) || businessCode(error) === 'unauthenticated')) break
    // Lỗi tạm thời của máy chủ (cổng API, quá giờ...): giữ mục này, gửi tiếp mục khác
    if (error && !isPermanent(error)) continue
    dropPending(userId, entry.slug, entry.readAt)
    if (!error) sent++
  }
  return sent
}

/** Lỗi gửi lại bao nhiêu lần cũng vậy: lỗi nghiệp vụ (truyện đã bị gỡ...) và lỗi dữ liệu */
const isPermanent = (error: PostgrestError) =>
  businessCode(error) !== null || isDataException(error)

export async function removeFromHistory(slug: string): Promise<void> {
  const userId = await historyOwner()
  if (!userId) return removeGuestHistory(slug)
  // Truyện không còn xem được thì cũng không hiện trong lịch sử, không có gì để xóa
  const storyId = await storyIdBySlug(slug)
  if (!storyId) return
  unwrap(await db().from('reading_history').delete().eq('user_id', userId).eq('story_id', storyId))
}

/** Như bản giả: lịch sử lúc còn là khách được gộp vào tài khoản trước, rồi xóa tất cả */
export async function clearHistory(): Promise<void> {
  const userId = await historyOwner()
  if (!userId) return clearGuestHistory()
  unwrap(await db().from('reading_history').delete().eq('user_id', userId))
}
