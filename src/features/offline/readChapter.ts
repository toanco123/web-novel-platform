// Đọc một chương cho trang đọc qua kho trên máy: có bản lưu thì trả ngay (không chờ mạng) và làm
// mới ở nền; chưa có thì dùng bản tải mạng rồi lưu ở nền, để lần sau hoặc lúc mất mạng đọc được ngay.
import { getChapter } from '@/features/chapters/api'
import { getStory } from '@/features/stories/api'
import { isNetworkError } from '@/lib/network'
import type { ChapterContent } from '@/types/chapter'
import {
  getSavedChapter,
  isSavable,
  markRead,
  removeSavedChapter,
  removeSavedStory,
  saveChapters,
} from './store'

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

/** Chương đang được lưu vào kho sau khi tải mạng (khóa `slug/number`) */
const saving = new Map<string, Promise<unknown>>()

/**
 * Ghi đã đọc vào bản lưu của chương, chờ lần lưu đang chạy (nếu có) xong trước: chương vừa tải mạng
 * được lưu ở nền nên lúc trang đọc ghi có thể chưa có bản lưu
 */
export function markReadSaved(slug: string, number: number, progress?: number) {
  const pending = saving.get(`${slug}/${number}`) ?? Promise.resolve()
  return pending.then(() => markRead(slug, number, progress))
}

async function refresh(
  slug: string,
  number: number,
  saved: ChapterContent,
  network: Promise<ChapterContent | null>,
  onFresh: (chapter: ChapterContent | null) => void,
) {
  let fresh: ChapterContent | null
  try {
    fresh = await network
  } catch {
    return // Mạng yếu/mất mạng: giữ bản lưu
  }
  // Báo trang đọc trước khi dọn kho: dọn lỗi cũng không để nội dung cũ trên màn hình
  if (!fresh) onFresh(null)
  else if (fingerprint(fresh) !== fingerprint(saved)) onFresh(fresh)
  else return
  await forget(slug, number, fresh).catch(() => {})
}

/** Dọn kho theo bản trên máy chủ: bỏ cả truyện đã bị gỡ hay ẩn, bỏ chương đã bị ẩn, lưu bản mới */
async function forget(slug: string, number: number, fresh: ChapterContent | null) {
  if (fresh) {
    await (isSavable(fresh) ? saveChapters([fresh]) : removeSavedStory(slug))
    return
  }
  // Không đọc được chương: xem cả truyện còn không (lỗi mạng thì chỉ bỏ chương này)
  const story = await getStory(slug).catch(() => undefined)
  const storyGone = story === null || story?.visibility === 'draft'
  await (storyGone ? removeSavedStory(slug) : removeSavedChapter(slug, number))
}

/**
 * @param onFresh nhận bản mới khi bản lưu đã cũ (null: chương không còn đọc được)
 */
export async function readChapter(
  slug: string,
  number: number,
  onFresh: (chapter: ChapterContent | null) => void,
): Promise<ChapterContent | null> {
  // Gọi mạng ngay, song song với đọc kho: chưa có bản lưu thì không phải chờ thêm một lượt
  const network = navigator.onLine ? getChapter(slug, number) : null
  // Có bản lưu thì lỗi mạng do refresh xử lý; chặn cảnh báo promise bị từ chối mà chưa ai bắt
  network?.catch(() => {})
  const saved = await getSavedChapter(slug, number).catch(() => null)
  if (saved) {
    if (network) void refresh(slug, number, saved, network, onFresh)
    return saved
  }
  if (!network) throw new ChapterNotSavedError()
  let chapter: ChapterContent | null
  try {
    chapter = await network
  } catch (error) {
    throw isNetworkError(error) ? new ChapterNotSavedError() : error
  }
  // Lưu ở nền, không bắt trang đọc chờ; "đã đọc" ghi sau khi lưu xong (markReadSaved). Lưu lỗi
  // (bộ nhớ đầy) vẫn đọc
  if (chapter) {
    const key = `${slug}/${number}`
    const save = saveChapters([chapter])
      .catch(() => {})
      .finally(() => {
        if (saving.get(key) === save) saving.delete(key)
      })
    saving.set(key, save)
  }
  return chapter
}
