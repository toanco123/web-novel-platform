// Danh mục truyện công khai = truyện có sẵn + truyện người dùng đã xuất bản.
// Các api đọc truyện/chương/thể loại đều lấy từ đây để truyện mới đăng hiện khắp nơi.
import type { ChapterSummary } from '@/types/chapter'
import type { Genre, Story } from '@/types/story'
import { loadViews, ratingsOf, totalViews } from './activity'
import { mockChapterContent } from './chapterContent'
import { mockChapters } from './chapters'
import { genres as seedGenres, stories as seedStories } from './stories'
import { loadChapters, loadUserGenres, loadUserStories, type StoredStory } from './userContent'

export function allGenres(): Genre[] {
  return [...seedGenres, ...loadUserGenres().map(({ createdAt: _createdAt, ...g }) => g)]
}

/**
 * Chuyển truyện người dùng sang dạng Story; số chương, chương mới nhất chỉ tính chương đã xuất bản.
 * Lượt đọc và điểm lấy từ hoạt động thật của người đọc (truyện có sẵn dùng số cố định).
 */
export function toStory(stored: StoredStory, genres = allGenres(), views = loadViews()): Story {
  const ratings = ratingsOf(stored.slug)
  const published = loadChapters(stored.id).filter((c) => c.status === 'published')
  const latest = published.at(-1)
  const lastPublish = published.reduce(
    (max, c) => (c.publishedAt && c.publishedAt > max ? c.publishedAt : max),
    stored.publishedAt ?? stored.createdAt,
  )
  return {
    id: stored.id,
    slug: stored.slug,
    title: stored.title,
    author: { slug: `tac-gia-${stored.owner.id}`, name: stored.owner.displayName },
    genres: stored.genreSlugs
      .map((slug) => genres.find((g) => g.slug === slug))
      .filter((g): g is Genre => !!g),
    status: stored.status,
    description: stored.description,
    coverUrl: stored.coverUrl,
    chapterCount: published.length,
    viewCount: totalViews(views[stored.slug]),
    ratingAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    ratingCount: ratings.length,
    firstChapterNumber: published[0]?.number ?? null,
    latestChapter: latest ? { number: latest.number, title: latest.title } : null,
    createdAt: stored.publishedAt ?? stored.createdAt,
    updatedAt: lastPublish,
    ownerId: stored.owner.id,
    visibility: stored.visibility,
  }
}

/**
 * Truyện người xem được thấy: truyện công khai, cộng truyện nháp của chính họ (để xem trước).
 * viewerId = null: người lạ / chưa đăng nhập.
 */
export function catalog(viewerId: string | null = null): Story[] {
  const genres = allGenres()
  const views = loadViews()
  const mine = loadUserStories()
    .filter((s) => s.visibility === 'published' || s.owner.id === viewerId)
    .map((s) => toStory(s, genres, views))
  return [...seedStories, ...mine]
}

export const findStory = (slug: string, viewerId: string | null = null) =>
  catalog(viewerId).find((s) => s.slug === slug) ?? null

/** Mọi slug đã dùng (kể cả truyện nháp của người khác) để tránh trùng đường dẫn */
export const takenStorySlugs = () =>
  new Set([...seedStories.map((s) => s.slug), ...loadUserStories().map((s) => s.slug)])

/** Mục lục chương cho người đọc: truyện có sẵn sinh giả, truyện người dùng lấy chương đã xuất bản */
export function readerChapters(story: Story): ChapterSummary[] {
  if (!story.ownerId) return mockChapters(story)
  return loadChapters(story.id)
    .filter((c) => c.status === 'published')
    .map((c) => ({ number: c.number, title: c.title, createdAt: c.publishedAt ?? c.createdAt }))
}

/** Nội dung một chương đã xuất bản; null nếu không có */
export function readerChapterContent(story: Story, number: number): string | null {
  if (!story.ownerId)
    return number >= 1 && number <= story.chapterCount
      ? mockChapterContent(story.slug, number)
      : null
  const chapter = loadChapters(story.id).find(
    (c) => c.number === number && c.status === 'published',
  )
  return chapter?.content ?? null
}
