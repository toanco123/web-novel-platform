// Chương đọc từ danh mục giả (truyện có sẵn + truyện người dùng trong localStorage): dùng cho test
// tự động và khi chạy không có Supabase (xem api.ts). Bản thật: api.remote.ts.
import { getSession } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { paginate } from '@/lib/pagination'
import { dayKey, loadViews, saveViews } from '@/mocks/activity'
import { findStory, readerChapterContent, readerChapters } from '@/mocks/catalog'
import type { ChapterContent, ChapterOrder, ChapterSummary } from '@/types/chapter'
import type { Page } from '@/types/page'
import type { Story } from '@/types/story'
import { CHAPTERS_PER_PAGE } from './shared'

export async function getChapterList(
  slug: string,
  { page = 1, order = 'asc' }: { page?: number; order?: ChapterOrder } = {},
): Promise<Page<ChapterSummary>> {
  await delay()
  const viewer = await getSession()
  const story = findStory(slug, viewer?.id ?? null)
  const all = story ? readerChapters(story) : []
  return paginate(order === 'desc' ? [...all].reverse() : all, page, CHAPTERS_PER_PAGE)
}

/** Truyện theo slug, theo quyền xem của người đang dùng (chủ truyện thấy cả bản nháp) */
async function readerStory(slug: string) {
  await delay()
  const viewer = await getSession()
  return findStory(slug, viewer?.id ?? null)
}

/** Chương thứ `index` trong mục lục `all`, dạng cho trang đọc */
function toChapterContent(
  story: Story,
  all: ChapterSummary[],
  index: number,
  content: string,
): ChapterContent {
  const neighbor = (c: ChapterSummary | undefined) =>
    c ? { number: c.number, title: c.title } : null
  return {
    story: {
      slug: story.slug,
      title: story.title,
      author: story.author,
      status: story.status,
      chapterCount: all.length,
      coverUrl: story.coverUrl,
      visibility: story.visibility,
    },
    number: all[index].number,
    title: all[index].title,
    content,
    publishedAt: all[index].createdAt,
    prev: neighbor(all[index - 1]),
    next: neighbor(all[index + 1]),
  }
}

/** Một chương để đọc, kèm chương trước/sau; null khi không có truyện hoặc chương */
export async function getChapter(slug: string, number: number): Promise<ChapterContent | null> {
  const story = await readerStory(slug)
  if (!story) return null
  // Chương của truyện người dùng có thể không liền số (chương nháp bị ẩn) nên tìm theo vị trí
  const all = readerChapters(story)
  const index = all.findIndex((c) => c.number === number)
  const content = index === -1 ? null : readerChapterContent(story, number)
  return content === null ? null : toChapterContent(story, all, index, content)
}

/** Tối đa `count` chương đã xuất bản có số ≥ `from`, tăng dần (tải trước, tải về đọc offline) */
export async function getChapterRange(
  slug: string,
  from: number,
  count: number,
): Promise<ChapterContent[]> {
  const story = await readerStory(slug)
  if (!story || count <= 0) return []
  const all = readerChapters(story)
  const start = all.findIndex((c) => c.number >= from)
  if (start === -1) return []
  return all.slice(start, start + count).flatMap((c, i) => {
    const content = readerChapterContent(story, c.number)
    return content === null ? [] : [toChapterContent(story, all, start + i, content)]
  })
}

/** Số chương đã xuất bản có số ≥ `from` */
export async function countChaptersFrom(slug: string, from: number): Promise<number> {
  const story = await readerStory(slug)
  return story ? readerChapters(story).filter((c) => c.number >= from).length : 0
}

// Mỗi người chỉ tính 1 lượt/chương cho mỗi lần tải trang (máy chủ thật sẽ chống đếm trùng theo phiên)
const counted = new Set<string>()

/** Ghi 1 lượt đọc chương; không tính lượt của chính tác giả */
export async function recordChapterView(slug: string, number: number) {
  const viewer = await getSession()
  const key = `${viewer?.id ?? ''}|${slug}#${number}`
  if (counted.has(key)) return
  const story = findStory(slug, viewer?.id ?? null)
  if (!story || (story.ownerId !== null && story.ownerId === viewer?.id)) return
  counted.add(key)

  const views = loadViews()
  const stats = views[slug] ?? { byChapter: {}, byDay: {} }
  const day = dayKey(new Date())
  saveViews({
    ...views,
    [slug]: {
      byChapter: { ...stats.byChapter, [number]: (stats.byChapter[number] ?? 0) + 1 },
      byDay: { ...stats.byDay, [day]: (stats.byDay[day] ?? 0) + 1 },
    },
  })
}
