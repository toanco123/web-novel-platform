// Đọc một chương cho trang đọc qua kho trên máy: có bản lưu thì trả ngay (không chờ mạng) và làm
// mới ở nền; chưa có thì tải mạng rồi lưu, để lần sau hoặc lúc mất mạng đọc được ngay.
import { getChapter } from '@/features/chapters/api'
import { isNetworkError } from '@/lib/network'
import type { ChapterContent } from '@/types/chapter'
import { getSavedChapter, removeSavedChapter, saveChapters } from './store'

/** Mất mạng mà chương chưa được lưu trên máy */
export class ChapterNotSavedError extends Error {
  constructor() {
    super('Chương này chưa được lưu để đọc offline.')
    this.name = 'ChapterNotSavedError'
  }
}

/** Phần người đọc thấy của chương; khác nhau thì bản lưu đã cũ */
const fingerprint = (c: ChapterContent) =>
  JSON.stringify([c.title, c.content, c.publishedAt, c.prev, c.next, c.story])

async function refresh(
  slug: string,
  number: number,
  saved: ChapterContent,
  onFresh: (chapter: ChapterContent | null) => void,
) {
  try {
    const fresh = await getChapter(slug, number)
    if (!fresh) {
      // Chương bị ẩn, truyện bị gỡ: không giữ bản lưu nữa
      await removeSavedChapter(slug, number)
      onFresh(null)
    } else if (fingerprint(fresh) !== fingerprint(saved)) {
      await saveChapters([fresh]).catch(() => {})
      onFresh(fresh)
    }
  } catch {
    // Mạng yếu/mất mạng: giữ bản lưu
  }
}

/**
 * @param onFresh nhận bản mới khi bản lưu đã cũ (null: chương không còn đọc được)
 */
export async function readChapter(
  slug: string,
  number: number,
  onFresh: (chapter: ChapterContent | null) => void,
): Promise<ChapterContent | null> {
  const saved = await getSavedChapter(slug, number).catch(() => null)
  if (saved) {
    if (navigator.onLine) void refresh(slug, number, saved, onFresh)
    return saved
  }
  if (!navigator.onLine) throw new ChapterNotSavedError()
  let chapter: ChapterContent | null
  try {
    chapter = await getChapter(slug, number)
  } catch (error) {
    throw isNetworkError(error) ? new ChapterNotSavedError() : error
  }
  // Lưu xong mới trả về để trang đọc ghi được "đã đọc" vào bản lưu; lưu lỗi (bộ nhớ đầy) vẫn đọc
  if (chapter) await saveChapters([chapter]).catch(() => {})
  return chapter
}
