// Nơi DUY NHẤT lấy dữ liệu chương cho người đọc. Giai đoạn UI đọc từ danh mục giả.
import { getSession } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { findStory, readerChapterContent, readerChapters } from '@/mocks/catalog'
import type { ChapterContent, ChapterOrder, ChapterSummary, Page } from '@/types/chapter'

export const CHAPTERS_PER_PAGE = 50

export async function getChapterList(
  slug: string,
  { page = 1, order = 'asc' }: { page?: number; order?: ChapterOrder } = {},
): Promise<Page<ChapterSummary>> {
  await delay()
  const viewer = await getSession()
  const story = findStory(slug, viewer?.id ?? null)
  const all = story ? readerChapters(story) : []
  const pageCount = Math.max(1, Math.ceil(all.length / CHAPTERS_PER_PAGE))
  const current = Math.min(Math.max(1, page), pageCount)
  const sorted = order === 'desc' ? [...all].reverse() : all
  const start = (current - 1) * CHAPTERS_PER_PAGE
  return {
    items: sorted.slice(start, start + CHAPTERS_PER_PAGE),
    total: all.length,
    page: current,
    pageCount,
  }
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
