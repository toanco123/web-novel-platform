// Nơi DUY NHẤT xử lý khu Sáng tác (truyện & chương của chính người dùng).
// Giai đoạn UI lưu localStorage; mọi hàm kiểm tra đăng nhập và quyền sở hữu.
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { slugify } from '@/lib/slugify'
import { takenStorySlugs } from '@/mocks/catalog'
import {
  loadChapters,
  loadUserStories,
  removeChapters,
  saveChapters,
  saveUserStories,
  type StoredStory,
} from '@/mocks/userContent'
import type { Chapter, ChapterStatus } from '@/types/chapter'
import type { StoryStatus } from '@/types/story'

type StudioErrorCode = 'not_found' | 'no_published_chapters' | 'last_published_chapter'

const messages: Record<StudioErrorCode, string> = {
  not_found: 'Không tìm thấy truyện này trong khu Sáng tác của bạn.',
  no_published_chapters: 'Cần xuất bản ít nhất 1 chương trước khi xuất bản truyện.',
  last_published_chapter:
    'Đây là chương công khai cuối cùng. Ẩn truyện trước rồi mới ẩn hoặc xóa chương này.',
}

export class StudioError extends Error {
  code: StudioErrorCode
  constructor(code: StudioErrorCode) {
    super(messages[code])
    this.name = 'StudioError'
    this.code = code
  }
}

export type StoryInput = {
  title: string
  description: string
  genreSlugs: string[]
  status: StoryStatus
  coverUrl: string | null
}

export type ChapterInput = { title: string; content: string }

export type MyStory = StoredStory & {
  chapterCount: number
  publishedCount: number
  draftCount: number
}

const now = () => new Date().toISOString()

function withCounts(story: StoredStory): MyStory {
  const chapters = loadChapters(story.id)
  const publishedCount = chapters.filter((c) => c.status === 'published').length
  return {
    ...story,
    chapterCount: chapters.length,
    publishedCount,
    draftCount: chapters.length - publishedCount,
  }
}

/** Truyện của user hiện tại; không có hoặc của người khác thì báo not_found (không lộ là có tồn tại) */
async function ownStory(id: string) {
  const user = await requireUser()
  const stories = loadUserStories()
  const story = stories.find((s) => s.id === id && s.owner.id === user.id)
  if (!story) throw new StudioError('not_found')
  return { user, story, stories }
}

function saveStory(stories: StoredStory[], updated: StoredStory) {
  saveUserStories(stories.map((s) => (s.id === updated.id ? updated : s)))
  return withCounts(updated)
}

// ── Truyện ──────────────────────────────────────────────────────────────

export async function getMyStories(): Promise<MyStory[]> {
  await delay()
  const user = await requireUser()
  return loadUserStories()
    .filter((s) => s.owner.id === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(withCounts)
}

export async function getMyStory(id: string): Promise<MyStory | null> {
  await delay()
  try {
    return withCounts((await ownStory(id)).story)
  } catch (error) {
    if (error instanceof StudioError) return null
    throw error
  }
}

/** Đường dẫn không đổi sau khi tạo (link đã chia sẻ vẫn dùng được khi đổi tên truyện) */
function uniqueSlug(title: string) {
  const base = slugify(title) || 'truyen'
  const taken = takenStorySlugs()
  let slug = base
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`
  return slug
}

export async function createStory(input: StoryInput): Promise<MyStory> {
  await delay(400)
  const user = await requireUser()
  const story: StoredStory = {
    ...normalize(input),
    id: crypto.randomUUID(),
    slug: uniqueSlug(input.title),
    owner: { id: user.id, displayName: user.displayName },
    visibility: 'draft',
    createdAt: now(),
    updatedAt: now(),
    publishedAt: null,
  }
  saveUserStories([...loadUserStories(), story])
  return withCounts(story)
}

export async function updateStory(id: string, input: StoryInput): Promise<MyStory> {
  await delay(400)
  const { story, stories } = await ownStory(id)
  return saveStory(stories, { ...story, ...normalize(input), updatedAt: now() })
}

export async function publishStory(id: string): Promise<MyStory> {
  await delay(300)
  const { story, stories } = await ownStory(id)
  if (withCounts(story).publishedCount === 0) throw new StudioError('no_published_chapters')
  return saveStory(stories, {
    ...story,
    visibility: 'published',
    publishedAt: story.publishedAt ?? now(),
    updatedAt: now(),
  })
}

export async function unpublishStory(id: string): Promise<MyStory> {
  await delay(300)
  const { story, stories } = await ownStory(id)
  return saveStory(stories, { ...story, visibility: 'draft', updatedAt: now() })
}

export async function deleteStory(id: string) {
  await delay(300)
  const { story, stories } = await ownStory(id)
  saveUserStories(stories.filter((s) => s.id !== story.id))
  removeChapters(story.id)
}

function normalize(input: StoryInput) {
  return {
    title: input.title.trim().replace(/\s+/g, ' '),
    description: input.description.trim(),
    genreSlugs: [...new Set(input.genreSlugs)],
    status: input.status,
    coverUrl: input.coverUrl,
  }
}

// ── Chương ──────────────────────────────────────────────────────────────

export async function getMyChapters(storyId: string): Promise<Chapter[]> {
  await delay()
  await ownStory(storyId)
  return loadChapters(storyId)
}

export async function getMyChapter(storyId: string, number: number): Promise<Chapter | null> {
  await delay()
  await ownStory(storyId)
  return loadChapters(storyId).find((c) => c.number === number) ?? null
}

/** Đánh dấu truyện vừa có thay đổi (để lên đầu danh sách Sáng tác) */
function touch(stories: StoredStory[], story: StoredStory) {
  saveUserStories(stories.map((s) => (s.id === story.id ? { ...story, updatedAt: now() } : s)))
}

function newChapter(
  storyId: string,
  number: number,
  input: ChapterInput,
  publish: boolean,
): Chapter {
  const time = now()
  return {
    id: crypto.randomUUID(),
    storyId,
    number,
    title: input.title.trim(),
    content: input.content.trim(),
    status: publish ? 'published' : 'draft',
    createdAt: time,
    updatedAt: time,
    publishedAt: publish ? time : null,
  }
}

/**
 * Tạo chương mới (không truyền number) hoặc sửa chương có sẵn.
 * publish = true thì xuất bản; false thì giữ nguyên trạng thái hiện tại (chương mới là nháp).
 */
export async function saveChapter(
  storyId: string,
  input: ChapterInput & { number?: number },
  { publish = false } = {},
): Promise<Chapter> {
  await delay(400)
  const { story, stories } = await ownStory(storyId)
  const chapters = loadChapters(storyId)
  const existing = input.number ? chapters.find((c) => c.number === input.number) : undefined

  let saved: Chapter
  if (existing) {
    saved = {
      ...existing,
      title: input.title.trim(),
      content: input.content.trim(),
      updatedAt: now(),
      ...(publish && existing.status === 'draft'
        ? { status: 'published' as const, publishedAt: existing.publishedAt ?? now() }
        : {}),
    }
    saveChapters(
      storyId,
      chapters.map((c) => (c.id === existing.id ? saved : c)),
    )
  } else {
    const number = (chapters.at(-1)?.number ?? 0) + 1
    saved = newChapter(storyId, number, input, publish)
    saveChapters(storyId, [...chapters, saved])
  }
  touch(stories, story)
  return saved
}

/** Chặn làm truyện đang công khai mất hết chương công khai */
function guardLastPublished(story: StoredStory, chapters: Chapter[], chapter: Chapter) {
  const publishedCount = chapters.filter((c) => c.status === 'published').length
  if (story.visibility === 'published' && chapter.status === 'published' && publishedCount === 1) {
    throw new StudioError('last_published_chapter')
  }
}

export async function setChapterStatus(storyId: string, number: number, status: ChapterStatus) {
  await delay(300)
  const { story, stories } = await ownStory(storyId)
  const chapters = loadChapters(storyId)
  const chapter = chapters.find((c) => c.number === number)
  if (!chapter) throw new StudioError('not_found')
  if (status === 'draft') guardLastPublished(story, chapters, chapter)
  const updated: Chapter = {
    ...chapter,
    status,
    publishedAt: status === 'published' ? (chapter.publishedAt ?? now()) : chapter.publishedAt,
    updatedAt: now(),
  }
  saveChapters(
    storyId,
    chapters.map((c) => (c.id === chapter.id ? updated : c)),
  )
  touch(stories, story)
  return updated
}

export async function deleteChapter(storyId: string, number: number) {
  await delay(300)
  const { story, stories } = await ownStory(storyId)
  const chapters = loadChapters(storyId)
  const chapter = chapters.find((c) => c.number === number)
  if (!chapter) throw new StudioError('not_found')
  guardLastPublished(story, chapters, chapter)
  saveChapters(
    storyId,
    chapters.filter((c) => c.id !== chapter.id),
  )
  touch(stories, story)
}

/** Thêm nhiều chương một lúc (nhập file), đánh số tiếp nối sau chương cuối */
export async function importChapters(storyId: string, items: ChapterInput[], publish: boolean) {
  await delay(500)
  const { story, stories } = await ownStory(storyId)
  const chapters = loadChapters(storyId)
  const start = (chapters.at(-1)?.number ?? 0) + 1
  const added = items.map((item, i) => newChapter(storyId, start + i, item, publish))
  saveChapters(storyId, [...chapters, ...added])
  touch(stories, story)
  return added
}
