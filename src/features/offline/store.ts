// Kho chương trên máy (IndexedDB) cho đọc offline: chương đã mở, chương tải trước và chương người
// đọc tự tải về (ghim, không tự xóa). Nội dung chương nằm ở store riêng (`contents`) để liệt kê và
// dọn kho chỉ đọc phần thông tin nhỏ. Kho dùng chung cho cả máy vì nội dung chương là công khai.
// Trình duyệt không cho dùng IndexedDB (chế độ riêng tư, bị chặn) thì kho coi như trống.
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { ChapterContent, ChapterNeighbor } from '@/types/chapter'

/** Chương không ghim giữ tối đa bấy nhiêu; vượt thì xóa chương lâu không dùng nhất */
export const MAX_AUTO_CHAPTERS = 300

type ChapterRecord = {
  /** `${slug}#${number}` */
  id: string
  slug: string
  number: number
  meta: Omit<ChapterContent, 'content'>
  /** 1: người đọc tải về (không tự xóa). Dạng số vì IndexedDB không đánh chỉ mục boolean */
  pinned: 0 | 1
  /** Dung lượng nội dung (UTF-8) */
  bytes: number
  savedAt: string
  readAt: string | null
  /** Mốc xóa chương lâu không dùng: lần đọc cuối, chưa đọc thì lần lưu */
  usedAt: string
  progress: number | null
}

interface OfflineDB extends DBSchema {
  chapters: {
    key: string
    value: ChapterRecord
    indexes: { bySlug: string; byUse: [number, string] }
  }
  contents: { key: string; value: string }
}

/** Truyện có chương trong kho (tab "Đã lưu") */
export type SavedStory = {
  story: ChapterContent['story']
  /** Số các chương đã lưu, tăng dần */
  numbers: number[]
  /** Có chương người đọc tự tải về */
  pinned: boolean
  bytes: number
  /** Chương để "Đọc tiếp": đọc gần nhất, chưa đọc chương nào thì chương nhỏ nhất */
  resume: { number: number; progress: number }
  usedAt: string
}

/** Trình duyệt không cho dùng IndexedDB (chế độ riêng tư, bị chặn): không lưu được chương nào */
export class OfflineUnavailableError extends Error {
  constructor() {
    super('Trình duyệt này không cho lưu dữ liệu nên không tải về được.')
    this.name = 'OfflineUnavailableError'
  }
}

export class OfflineStorageFullError extends Error {
  constructor() {
    super('Bộ nhớ máy đã đầy.')
    this.name = 'OfflineStorageFullError'
  }
}

const idOf = (slug: string, number: number) => `${slug}#${number}`
const encoder = new TextEncoder()
const isQuotaError = (error: unknown) =>
  (error as { name?: unknown } | null)?.name === 'QuotaExceededError'

/** Mở kho quá bấy nhiêu ms thì coi như không có kho (WebKit đôi khi treo, không báo xong) */
export const OFFLINE_OPEN_TIMEOUT_MS = 3000

let dbPromise: Promise<IDBPDatabase<OfflineDB> | null> | undefined

function database() {
  dbPromise ??= open()
  return dbPromise
}

async function open(): Promise<IDBPDatabase<OfflineDB> | null> {
  if (typeof indexedDB === 'undefined') return null
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  try {
    // indexedDB.open có thể ném ngay (SecurityError trong khung bị sandbox)
    const opening = openDB<OfflineDB>('offline-reading', 1, {
      upgrade(db) {
        const chapters = db.createObjectStore('chapters', { keyPath: 'id' })
        chapters.createIndex('bySlug', 'slug')
        chapters.createIndex('byUse', ['pinned', 'usedAt'])
        db.createObjectStore('contents')
      },
    })
    // Mở xong sau khi đã bỏ cuộc: đóng lại, lần tải trang sau mở lại
    void opening.then((db) => timedOut && db.close()).catch(() => {})
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true
        resolve(null)
      }, OFFLINE_OPEN_TIMEOUT_MS)
    })
    return await Promise.race([opening, timeout])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Kho dùng được không (trình duyệt cho dùng IndexedDB) */
export async function offlineAvailable() {
  return (await database()) !== null
}

/** Chỉ dùng trong test: đóng kết nối để test sau mở kho mới */
export async function resetOfflineDatabase() {
  const db = await dbPromise
  db?.close()
  dbPromise = undefined
}

let persistAsked = false

/** Xin trình duyệt giữ kho lâu dài (Safari tự xóa dữ liệu của trang không dùng sau 7 ngày) */
async function requestPersistence() {
  if (persistAsked) return
  persistAsked = true
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Trình duyệt không hỗ trợ: dữ liệu vẫn lưu, chỉ có thể bị dọn khi máy thiếu chỗ
  }
}

/** Chương đã lưu, đủ nội dung; null nếu chưa có */
export async function getSavedChapter(slug: string, number: number) {
  const db = await database()
  if (!db) return null
  const tx = db.transaction(['chapters', 'contents'])
  const id = idOf(slug, number)
  const [record, content] = await Promise.all([
    tx.objectStore('chapters').get(id),
    tx.objectStore('contents').get(id),
  ])
  return record && content !== undefined ? ({ ...record.meta, content } as ChapterContent) : null
}

async function put(db: IDBPDatabase<OfflineDB>, chapters: ChapterContent[], pinned: boolean) {
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  const store = tx.objectStore('chapters')
  const now = new Date().toISOString()
  await Promise.all([
    ...chapters.map(async ({ content, ...meta }) => {
      const id = idOf(meta.story.slug, meta.number)
      const old = await store.get(id)
      await store.put({
        id,
        slug: meta.story.slug,
        number: meta.number,
        meta,
        pinned: pinned || old?.pinned === 1 ? 1 : 0,
        bytes: encoder.encode(content).length,
        savedAt: now,
        readAt: old?.readAt ?? null,
        usedAt: old?.readAt ?? now,
        progress: old?.progress ?? null,
      })
      await tx.objectStore('contents').put(content, id)
    }),
    tx.done,
  ])
}

/**
 * Xóa chương không ghim dùng lâu nhất tới khi còn MAX_AUTO_CHAPTERS; `fraction` > 0 thì xóa thêm
 * chừng ấy phần số chương không ghim (lấy chỗ khi bộ nhớ đầy). Không đụng truyện `keep`.
 */
async function evict(db: IDBPDatabase<OfflineDB>, keep: string, fraction = 0) {
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  const index = tx.objectStore('chapters').index('byUse')
  const unpinned = IDBKeyRange.bound([0, ''], [0, '\uffff'])
  const total = await index.count(unpinned)
  let excess = Math.max(total - MAX_AUTO_CHAPTERS, 0) + Math.ceil(total * fraction)
  // Chỉ đọc khóa (không nạp nội dung), dùng lâu nhất trước
  let cursor = excess > 0 ? await index.openKeyCursor(unpinned) : null
  while (cursor && excess > 0) {
    const id = cursor.primaryKey
    if (!id.startsWith(`${keep}#`)) {
      await Promise.all([
        tx.objectStore('chapters').delete(id),
        tx.objectStore('contents').delete(id),
      ])
      excess--
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

/** Kho dùng chung cho cả máy nên chỉ giữ chương của truyện công khai */
export const isSavable = (chapter: ChapterContent) => chapter.story.visibility === 'published'

/**
 * Lưu (hoặc làm mới) các chương của truyện công khai (bỏ qua chương khác); giữ readAt/progress đã
 * có, chương đã ghim vẫn ghim. Sau đó dọn chương không ghim vượt giới hạn (trừ truyện vừa lưu). Bộ
 * nhớ đầy thì dọn 20% rồi thử lại một lần; vẫn đầy thì ném OfflineStorageFullError.
 */
export async function saveChapters(
  all: ChapterContent[],
  { pinned = false }: { pinned?: boolean } = {},
) {
  const chapters = all.filter(isSavable)
  const db = await database()
  if (!db || chapters.length === 0) return
  const keep = chapters[0].story.slug
  void requestPersistence()
  try {
    await put(db, chapters, pinned)
  } catch (error) {
    if (!isQuotaError(error)) throw error
    await evict(db, keep, 0.2)
    try {
      await put(db, chapters, pinned)
    } catch (retryError) {
      throw isQuotaError(retryError) ? new OfflineStorageFullError() : retryError
    }
  }
  await evict(db, keep)
}

/** Ghi đã đọc chương (và vị trí cuộn nếu có); chương chưa lưu thì bỏ qua */
export async function markRead(slug: string, number: number, progress?: number) {
  const db = await database()
  if (!db) return
  const tx = db.transaction('chapters', 'readwrite')
  const record = await tx.store.get(idOf(slug, number))
  if (record) {
    const now = new Date().toISOString()
    await tx.store.put({
      ...record,
      readAt: now,
      usedAt: now,
      progress: progress ?? record.progress,
    })
  }
  await tx.done
}

/** Ghim các chương đã có (người đọc tải về khoảng chương chứa chúng) */
export async function pinChapters(slug: string, numbers: number[]) {
  const db = await database()
  if (!db || numbers.length === 0) return
  const tx = db.transaction('chapters', 'readwrite')
  await Promise.all([
    ...numbers.map(async (number) => {
      const record = await tx.store.get(idOf(slug, number))
      if (record && record.pinned === 0) await tx.store.put({ ...record, pinned: 1 })
    }),
    tx.done,
  ])
}

/**
 * Lần theo chương sau (`next`) của các chương đã lưu từ chương `from`, tối đa `limit` chương. Trả
 * các chương đã có và số chương để hỏi tiếp máy chủ (null: đã đủ `limit` chương). Chương sau trong
 * bản lưu có thể đã cũ nên vẫn hỏi từ số kế tiếp khi bản lưu ghi "không có chương sau" (truyện ra
 * thêm chương sau khi lưu) hoặc nhảy cóc số (chương ở giữa lúc lưu còn là nháp, nay có thể đã đăng).
 */
export async function walkSaved(
  slug: string,
  from: number,
  limit: number,
): Promise<{ saved: number[]; missing: number | null }> {
  const db = await database()
  if (!db) return { saved: [], missing: from }
  const store = db.transaction('chapters').store
  const saved: number[] = []
  let number = from
  while (saved.length < limit) {
    const record = await store.get(idOf(slug, number))
    if (!record) return { saved, missing: number }
    saved.push(number)
    number++
    if (record.meta.next?.number !== number) break
  }
  return { saved, missing: saved.length < limit ? number : null }
}

/** Các truyện có chương trong kho, dùng gần nhất trước */
export async function listSavedStories(): Promise<SavedStory[]> {
  const db = await database()
  if (!db) return []
  const bySlug = new Map<string, ChapterRecord[]>()
  for (const record of await db.getAll('chapters')) {
    const list = bySlug.get(record.slug) ?? []
    list.push(record)
    bySlug.set(record.slug, list)
  }
  return [...bySlug.values()]
    .map((list): SavedStory => {
      list.sort((a, b) => a.number - b.number)
      const read = list
        .filter((r) => r.readAt !== null)
        .sort((a, b) => b.readAt!.localeCompare(a.readAt!))[0]
      // Thông tin truyện lấy từ bản lưu mới nhất
      const latest = list.reduce((a, b) => (b.savedAt > a.savedAt ? b : a))
      const resume = read ?? list[0]
      return {
        story: latest.meta.story,
        numbers: list.map((r) => r.number),
        pinned: list.some((r) => r.pinned === 1),
        bytes: list.reduce((sum, r) => sum + r.bytes, 0),
        resume: { number: resume.number, progress: resume.progress ?? 0 },
        usedAt: list.reduce((max, r) => (r.usedAt > max ? r.usedAt : max), ''),
      }
    })
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
}

/** Các chương đã lưu của một truyện (số và tên), tăng dần */
export async function savedChapterList(slug: string): Promise<ChapterNeighbor[]> {
  const db = await database()
  if (!db) return []
  const records = await db.getAllFromIndex('chapters', 'bySlug', slug)
  return records
    .sort((a, b) => a.number - b.number)
    .map((r) => ({ number: r.number, title: r.meta.title }))
}

export async function removeSavedChapter(slug: string, number: number) {
  const db = await database()
  if (!db) return
  const id = idOf(slug, number)
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  await Promise.all([
    tx.objectStore('chapters').delete(id),
    tx.objectStore('contents').delete(id),
    tx.done,
  ])
}

export async function removeSavedStory(slug: string) {
  const db = await database()
  if (!db) return
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  const ids = await tx.objectStore('chapters').index('bySlug').getAllKeys(slug)
  await Promise.all([
    ...ids.flatMap((id) => [
      tx.objectStore('chapters').delete(id),
      tx.objectStore('contents').delete(id),
    ]),
    tx.done,
  ])
}

export async function clearSaved() {
  const db = await database()
  if (!db) return
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  await Promise.all([
    tx.objectStore('chapters').clear(),
    tx.objectStore('contents').clear(),
    tx.done,
  ])
}
