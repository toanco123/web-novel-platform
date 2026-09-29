// Đọc một chương cho trang đọc qua kho trên máy: có bản lưu thì trả ngay (không chờ mạng) và làm
// mới ở nền; chưa có thì tải mạng rồi lưu, để lần sau hoặc lúc mất mạng đọc được ngay.
import { getChapter } from '@/features/chapters/api'
import { getStory } from '@/features/stories/api'
import { isNetworkError } from '@/lib/network'
import type { ChapterContent } from '@/types/chapter'
import {
  getSavedChapter,
  isSavable,
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

async function refresh(
  slug: string,
  number: number,
  saved: ChapterContent,
  onFresh: (chapter: ChapterContent | null) => void,
) {
  let fresh: ChapterContent | null
  try {
    fresh = await getChapter(slug, number)
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
