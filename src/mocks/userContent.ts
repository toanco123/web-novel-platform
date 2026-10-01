// Nội dung do người dùng tạo (thể loại, truyện, chương), lưu localStorage trong giai đoạn mock.
// Chỉ các api.ts (genres, studio, stories, chapters) được dùng file này.
import { readMock, writeMockStrict } from '@/lib/mockStorage'
import type { Chapter } from '@/types/chapter'
import type { Genre, StoryReview, StoryStatus, StoryVisibility } from '@/types/story'

export type StoredGenre = Genre & { createdAt: string }

export type StoredStory = {
  id: string
  slug: string
  title: string
  description: string
  genreSlugs: string[]
  status: StoryStatus
  coverUrl: string | null
  owner: { id: string; displayName: string }
  visibility: StoryVisibility
  createdAt: string
  updatedAt: string
  /** Lần đầu xuất bản (dùng cho "Truyện mới ra") */
  publishedAt: string | null
  /** Bị admin gỡ (không có ở dữ liệu cũ) */
  takedown?: { at: string; reason: string } | null
  /** Bút danh / tác giả gốc (không có ở dữ liệu cũ) */
  authorName?: string | null
  /** Trạng thái duyệt; không có (undefined) ở dữ liệu cũ, đọc qua storyReview() */
  review?: StoryReview | null
}

const GENRES_KEY = 'mock-user-genres'
const STORIES_KEY = 'mock-user-stories'
const chaptersKey = (storyId: string) => `mock-chapters:${storyId}`

export const loadUserGenres = () => readMock<StoredGenre[]>(GENRES_KEY, [])
export const saveUserGenres = (genres: StoredGenre[]) => writeMockStrict(GENRES_KEY, genres)

export const loadUserStories = () => readMock<StoredStory[]>(STORIES_KEY, [])
export const saveUserStories = (stories: StoredStory[]) => writeMockStrict(STORIES_KEY, stories)

/** Chương của một truyện, luôn xếp theo số chương tăng dần */
export const loadChapters = (storyId: string) =>
  readMock<Chapter[]>(chaptersKey(storyId), []).sort((a, b) => a.number - b.number)
export const saveChapters = (storyId: string, chapters: Chapter[]) =>
  writeMockStrict(chaptersKey(storyId), chapters)
export const removeChapters = (storyId: string) => writeMockStrict(chaptersKey(storyId), null)

export const pendingReview = (time: string): StoryReview => ({
  status: 'pending',
  submittedAt: time,
  reviewedAt: null,
  reason: null,
})

export const approvedReview = (time: string): StoryReview => ({
  status: 'approved',
  submittedAt: null,
  reviewedAt: time,
  reason: null,
})

/**
 * Trạng thái duyệt của truyện. Dữ liệu cũ (trước khi có duyệt truyện) không có trường này: truyện đã
 * từng công khai và không bị gỡ coi như đã duyệt, giống bước chuyển dữ liệu của migration story_review.
 */
export function storyReview(story: StoredStory): StoryReview | null {
  if (story.review !== undefined) return story.review
  return story.publishedAt && !story.takedown ? approvedReview(story.publishedAt) : null
}
