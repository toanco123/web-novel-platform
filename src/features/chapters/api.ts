// Nơi DUY NHẤT lấy dữ liệu chương cho người đọc. Giai đoạn UI đọc từ danh mục giả.
import { getSession } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { paginate } from '@/lib/pagination'
import { dayKey, loadViews, saveViews } from '@/mocks/activity'
import { findStory, readerChapterContent, readerChapters } from '@/mocks/catalog'
import type { ChapterContent, ChapterOrder, ChapterSummary } from '@/types/chapter'
import type { Page } from '@/types/page'

export const CHAPTERS_PER_PAGE = 50

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

/** Một chương để đọc, kèm chương trước/sau; null khi không có truyện hoặc chương */
export async function getChapter(slug: string, number: number): Promise<ChapterContent | null> {
  await delay()
  const viewer = await getSession()
  const story = findStory(slug, viewer?.id ?? null)
  if (!story) return null
  // Chương của truyện người dùng có thể không liền số (chương nháp bị ẩn) nên tìm theo vị trí
  const all = readerChapters(story)
  const index = all.findIndex((c) => c.number === number)
  const content = index === -1 ? null : readerChapterContent(story, number)
  if (content === null) return null
  const neighbor = (c: ChapterSummary | undefined) =>
    c ? { number: c.number, title: c.title } : null
  return {
    story: {
      slug: story.slug,
      title: story.title,
      author: story.author,
      status: story.status,
      chapterCount: all.length,
    },
    number,
    title: all[index].title,
    content,
    publishedAt: all[index].createdAt,
    prev: neighbor(all[index - 1]),
    next: neighbor(all[index + 1]),
  }
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
