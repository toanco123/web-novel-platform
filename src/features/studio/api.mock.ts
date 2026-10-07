// Khu Sáng tác giả lưu trong localStorage: dùng cho test tự động và khi chạy không có Supabase
// (xem api.ts). Bản thật: api.remote.ts. Mọi hàm kiểm tra đăng nhập và quyền sở hữu.
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay, readMock, writeMock } from '@/lib/mockStorage'
import { slugify } from '@/lib/slugify'
import {
  dayKey,
  followerCount,
  loadReports,
  loadUserComments,
  loadViews,
  ratingsOf,
  recentViews,
  saveReports,
  removeComments,
  storyVoteCount,
  totalViews,
} from '@/mocks/activity'
import { takenStorySlugs } from '@/mocks/catalog'
import {
  approvedReview,
  loadChapters,
  loadUserStories,
  pendingReview,
  removeChapters,
  saveChapters,
  saveUserStories,
  storyReview,
  type StoredStory,
} from '@/mocks/userContent'
import type { Chapter, ChapterStatus } from '@/types/chapter'
import type { ChapterReport } from '@/types/report'
import type { User } from '@/types/user'
import {
  CHAPTERS_PER_DAY,
  CONTENT_BYTES_PER_DAY,
  type ChapterInput,
  type FirstChapterInput,
  type MyStory,
  normalizeStoryInput as normalize,
  STATS_DAYS,
  type StoryInput,
  type StoryStats,
  STORIES_PER_DAY,
  StudioError,
} from './shared'

const now = () => new Date().toISOString()

function withCounts(story: StoredStory): MyStory {
  const chapters = loadChapters(story.id)
  const publishedCount = chapters.filter((c) => c.status === 'published').length
  return {
    ...story,
    chapterCount: chapters.length,
    publishedCount,
    draftCount: chapters.length - publishedCount,
    views: totalViews(loadViews()[story.slug]),
    followers: followerCount(story.slug),
    openReports: loadReports().filter((r) => r.storySlug === story.slug && r.status === 'open')
      .length,
    takedown: story.takedown ?? null,
    review: storyReview(story),
    authorName: story.authorName ?? null,
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

// Hạn mức mỗi ngày của tác giả, cùng mức với trigger charge_author của DB (migration
// security_hardening): tính cả truyện/chương xóa sau đó và dung lượng nội dung khi sửa chương
type AuthorUsage = { day: string; stories: number; chapters: number; bytes: number }
const USAGE_KEY = 'mock-author-usage'

const contentBytes = (content: string) => new TextEncoder().encode(content.trim()).length

function chargeAuthor(user: User, add: { stories?: number; chapters?: number; bytes?: number }) {
  if (user.isAdmin) return
  const all = readMock<Record<string, AuthorUsage>>(USAGE_KEY, {})
  const day = dayKey(new Date())
  const used = all[user.id]?.day === day ? all[user.id] : { day, stories: 0, chapters: 0, bytes: 0 }
  const next = {
    day,
    stories: used.stories + (add.stories ?? 0),
    chapters: used.chapters + (add.chapters ?? 0),
    bytes: used.bytes + (add.bytes ?? 0),
  }
  if (next.stories > STORIES_PER_DAY) throw new StudioError('story_limit')
  if (next.chapters > CHAPTERS_PER_DAY || next.bytes > CONTENT_BYTES_PER_DAY) {
    throw new StudioError('chapter_limit')
  }
  writeMock(USAGE_KEY, { ...all, [user.id]: next })
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

/** Tạo truyện (nháp), kèm chương đầu tiên nếu người viết đã viết ngay trong form tạo truyện */
export async function createStory(
  input: StoryInput,
  firstChapter?: FirstChapterInput,
): Promise<MyStory> {
  await delay(400)
  const user = await requireUser()
  chargeAuthor(user, {
    stories: 1,
    chapters: firstChapter ? 1 : 0,
    bytes: firstChapter ? contentBytes(firstChapter.chapter.content) : 0,
  })
  const publish = firstChapter?.publish ?? false
  // Tác giả: chương đầu xuất bản và truyện vào hàng chờ duyệt; quản trị viên: công khai luôn
  const live = publish && user.isAdmin
  const time = now()
  const story: StoredStory = {
    ...normalize(input),
    id: crypto.randomUUID(),
    slug: uniqueSlug(input.title),
    owner: { id: user.id, displayName: user.displayName },
    visibility: live ? 'published' : 'draft',
    createdAt: time,
    updatedAt: time,
    publishedAt: live ? time : null,
    review: live ? approvedReview(time) : publish ? pendingReview(time) : null,
  }
  // Ghi chương trước: localStorage đầy thì báo lỗi mà không để lại truyện rỗng
  if (firstChapter) {
    const { chapter } = firstChapter
    saveChapters(story.id, [newChapter(story.id, chapter.number ?? 1, chapter, publish)])
  }
  try {
    saveUserStories([...loadUserStories(), story])
  } catch (error) {
    if (firstChapter) removeChapters(story.id)
    throw error
  }
  return withCounts(story)
}

export async function updateStory(id: string, input: StoryInput): Promise<MyStory> {
  await delay(400)
  const { story, stories } = await ownStory(id)
  return saveStory(stories, { ...story, ...normalize(input), updatedAt: now() })
}

export async function publishStory(id: string): Promise<MyStory> {
  await delay(300)
  const { user, story, stories } = await ownStory(id)
  if (story.takedown) throw new StudioError('story_taken_down')
  if (withCounts(story).publishedCount === 0) throw new StudioError('no_published_chapters')
  const review = storyReview(story)
  // Quản trị viên miễn duyệt (trigger stories_require_review của DB)
  if (!user.isAdmin && review?.status !== 'approved') throw new StudioError('story_not_approved')
  return saveStory(stories, {
    ...story,
    visibility: 'published',
    publishedAt: story.publishedAt ?? now(),
    updatedAt: now(),
    review: review?.status === 'approved' ? review : approvedReview(now()),
  })
}

/** Gửi truyện cho ban quản trị duyệt (lần đầu, hoặc lại sau khi bị từ chối) */
export async function submitStoryForReview(id: string): Promise<MyStory> {
  await delay(300)
  const { story, stories } = await ownStory(id)
  const review = storyReview(story)
  if (story.takedown) throw new StudioError('story_taken_down')
  if (review?.status === 'pending') throw new StudioError('already_pending')
  if (review?.status === 'approved') throw new StudioError('already_approved')
  if (withCounts(story).publishedCount === 0) throw new StudioError('no_published_chapters')
  return saveStory(stories, { ...story, review: pendingReview(now()), updatedAt: now() })
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
 * Tạo chương mới (không truyền `number`) hoặc sửa chương có sẵn (`number` là số hiện tại).
 * `newNumber`: số chương muốn lưu, được bỏ trống số ở giữa (có chương 1 thì viết luôn chương 3).
 * Chương mới mặc định lấy số tiếp theo. Chỉ đổi số được với chương chưa xuất bản lần nào,
 * vì link, lịch sử đọc và bình luận của người đọc đều theo số chương.
 * publish = true thì xuất bản; false thì giữ nguyên trạng thái hiện tại (chương mới là nháp).
 */
export async function saveChapter(
  storyId: string,
  input: ChapterInput & { number?: number; newNumber?: number },
  { publish = false } = {},
): Promise<Chapter> {
  await delay(400)
  const { user, story, stories } = await ownStory(storyId)
  const chapters = loadChapters(storyId)
  const existing =
    input.number === undefined ? undefined : chapters.find((c) => c.number === input.number)
  if (input.number !== undefined && !existing) throw new StudioError('not_found')
  const number = input.newNumber ?? existing?.number ?? (chapters.at(-1)?.number ?? 0) + 1
  if (chapters.some((c) => c.number === number && c.id !== existing?.id)) {
    throw new StudioError('chapter_exists')
  }
  if (existing && number !== existing.number && existing.publishedAt) {
    throw new StudioError('chapter_number_locked')
  }
  if (!existing) chargeAuthor(user, { chapters: 1, bytes: contentBytes(input.content) })
  else if (input.content.trim() !== existing.content) {
    chargeAuthor(user, { bytes: contentBytes(input.content) })
  }

  let saved: Chapter
  if (existing) {
    saved = {
      ...existing,
      number,
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
    saved = newChapter(storyId, number, input, publish)
    saveChapters(storyId, [...chapters, saved])
  }
  touch(stories, story)
  return saved
}

/** Chặn làm truyện đang công khai hoặc đang chờ duyệt mất hết chương đã xuất bản */
function guardLastPublished(story: StoredStory, chapters: Chapter[], chapter: Chapter) {
  const publishedCount = chapters.filter((c) => c.status === 'published').length
  const live = story.visibility === 'published' || storyReview(story)?.status === 'pending'
  if (live && chapter.status === 'published' && publishedCount === 1) {
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
  // Bình luận và báo lỗi gắn theo số chương: xóa cùng chương, để chương viết lại sau với số này
  // không nhận nhầm của chương cũ
  const ofChapter = (c: { storySlug: string; chapterNumber: number | null }) =>
    c.storySlug === story.slug && c.chapterNumber === number
  removeComments(ofChapter)
  saveReports(loadReports().filter((r) => !ofChapter(r)))
  touch(stories, story)
}

/** Thêm nhiều chương một lúc (nhập file), đánh số tiếp nối sau chương cuối */
export async function importChapters(storyId: string, items: ChapterInput[], publish: boolean) {
  await delay(500)
  const { user, story, stories } = await ownStory(storyId)
  chargeAuthor(user, {
    chapters: items.length,
    bytes: items.reduce((sum, item) => sum + contentBytes(item.content), 0),
  })
  const chapters = loadChapters(storyId)
  const start = (chapters.at(-1)?.number ?? 0) + 1
  const added = items.map((item, i) => newChapter(storyId, start + i, item, publish))
  saveChapters(storyId, [...chapters, ...added])
  touch(stories, story)
  return added
}

// ── Thống kê & báo lỗi ──────────────────────────────────────────────────

export async function getStoryStats(storyId: string): Promise<StoryStats> {
  await delay()
  const { story } = await ownStory(storyId)
  const stats = loadViews()[story.slug]
  const ratings = ratingsOf(story.slug)
  const today = new Date()
  const viewsByDay = Array.from({ length: STATS_DAYS }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (STATS_DAYS - 1 - i))
    const day = dayKey(d)
    return { day, views: stats?.byDay[day] ?? 0 }
  })
  return {
    views: totalViews(stats),
    viewsRecent: recentViews(stats, STATS_DAYS, today),
    viewsByDay,
    viewsByChapter: loadChapters(story.id)
      .filter((c) => c.status === 'published')
      .map((c) => ({ number: c.number, title: c.title, views: stats?.byChapter[c.number] ?? 0 })),
    followers: followerCount(story.slug),
    ratingAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    ratingCount: ratings.length,
    comments: loadUserComments().filter((c) => c.storySlug === story.slug).length,
    votes: { total: storyVoteCount(story.slug), week: storyVoteCount(story.slug, 7) },
  }
}

/** Báo lỗi chương của truyện mình: chưa xử lý trước, rồi mới nhất trước */
export async function getStoryReports(storyId: string): Promise<ChapterReport[]> {
  await delay()
  const { story } = await ownStory(storyId)
  return loadReports()
    .filter((r) => r.storySlug === story.slug)
    .sort(
      (a, b) =>
        Number(a.status === 'resolved') - Number(b.status === 'resolved') ||
        b.createdAt.localeCompare(a.createdAt),
    )
}

export async function setReportStatus(
  storyId: string,
  reportId: string,
  status: ChapterReport['status'],
) {
  await delay(300)
  const { story } = await ownStory(storyId)
  const reports = loadReports()
  if (!reports.some((r) => r.id === reportId && r.storySlug === story.slug)) {
    throw new StudioError('not_found')
  }
  saveReports(reports.map((r) => (r.id === reportId ? { ...r, status } : r)))
}
