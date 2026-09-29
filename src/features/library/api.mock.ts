// Tủ truyện giả lưu trong localStorage (src/mocks/activity.ts): dùng cho test tự động và khi chạy
// không có Supabase (xem api.ts). Bản thật: api.remote.ts.
// Khách chưa đăng nhập vẫn có lịch sử đọc (lưu dưới khóa GUEST), được gộp vào tài khoản ở lần đầu
// đăng nhập.
import { getSession, requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import {
  GUEST,
  loadFollows,
  loadHistory,
  saveFollows,
  saveHistory,
  type FollowEntry,
} from '@/mocks/activity'
import { catalog, readerChapters } from '@/mocks/catalog'
import type { HistoryItem, LibraryItem, ReadingProgress } from '@/types/library'
import type { Story } from '@/types/story'
import { addToHistory, HISTORY_LIMIT, mergeHistory, type ProgressInput } from './shared'

const now = () => new Date().toISOString()
const storyMap = (viewerId: string | null) => new Map(catalog(viewerId).map((s) => [s.slug, s]))

/** Số chương đã xuất bản sau chương `seen` */
const countNewChapters = (story: Story, seen: number) =>
  readerChapters(story).filter((c) => c.number > seen).length

/** Chủ lịch sử đang xem; lần đầu có tài khoản thì gộp lịch sử lúc còn là khách vào */
async function historyOwner() {
  const user = await getSession()
  if (!user) return GUEST
  const guest = loadHistory(GUEST)
  if (guest.length) {
    saveHistory(user.id, mergeHistory(loadHistory(user.id), guest))
    saveHistory(GUEST, [])
  }
  return user.id
}

// ── Theo dõi ────────────────────────────────────────────────────────────

export async function getFollowStatus(slug: string): Promise<boolean> {
  await delay(100)
  const user = await requireUser()
  return loadFollows(user.id).some((e) => e.slug === slug)
}

async function setFollow(slug: string, follow: boolean) {
  await delay()
  const user = await requireUser()
  const entries = loadFollows(user.id)
  if (follow === entries.some((e) => e.slug === slug)) return follow
  if (!follow) {
    saveFollows(
      user.id,
      entries.filter((e) => e.slug !== slug),
    )
    return follow
  }
  // Mốc "đã thấy": chương mới nhất lúc theo dõi, hoặc chương đã đọc tới nếu xa hơn
  const story = catalog(user.id).find((s) => s.slug === slug)
  const read = loadHistory(user.id).find((h) => h.slug === slug)?.chapter ?? 0
  const entry: FollowEntry = {
    slug,
    followedAt: now(),
    seenChapter: Math.max(story?.latestChapter?.number ?? 0, read),
  }
  saveFollows(user.id, [entry, ...entries])
  return follow
}

export const followStory = (slug: string) => setFollow(slug, true)
export const unfollowStory = (slug: string) => setFollow(slug, false)

/** Dữ liệu theo dõi kiểu cũ chưa có mốc "đã thấy": lấy chương mới nhất hiện tại làm mốc */
function followsWithBaseline(userId: string, stories: Map<string, Story>) {
  const entries = loadFollows(userId)
  if (entries.every((e) => e.seenChapter !== null)) return entries
  const fixed = entries.map((e) =>
    e.seenChapter === null
      ? { ...e, seenChapter: stories.get(e.slug)?.latestChapter?.number ?? 0 }
      : e,
  )
  saveFollows(userId, fixed)
  return fixed
}

function libraryItems(userId: string): LibraryItem[] {
  const stories = storyMap(userId)
  const history = loadHistory(userId)
  return followsWithBaseline(userId, stories)
    .flatMap((entry) => {
      // Truyện đã bị gỡ hoặc tác giả ẩn đi thì tạm không hiện
      const story = stories.get(entry.slug)
      if (!story) return []
      return {
        story,
        followedAt: entry.followedAt,
        newChapters: countNewChapters(story, entry.seenChapter ?? 0),
        progress: history.find((h) => h.slug === entry.slug) ?? null,
      }
    })
    .sort(
      (a, b) =>
        Number(b.newChapters > 0) - Number(a.newChapters > 0) ||
        b.story.updatedAt.localeCompare(a.story.updatedAt),
    )
}

/** Truyện đang theo dõi; truyện có chương mới lên đầu, rồi tới truyện mới cập nhật */
export async function getLibrary(): Promise<LibraryItem[]> {
  await delay()
  const user = await requireUser()
  await historyOwner()
  return libraryItems(user.id)
}

/** Số truyện đang theo dõi có chương mới (chấm đỏ ở header) */
export async function getLibraryUpdateCount(): Promise<number> {
  await delay(100)
  const user = await requireUser()
  return libraryItems(user.id).filter((item) => item.newChapters > 0).length
}

// ── Lịch sử đọc ─────────────────────────────────────────────────────────

export async function getReadingHistory(limit = HISTORY_LIMIT): Promise<HistoryItem[]> {
  await delay()
  const owner = await historyOwner()
  const stories = storyMap(owner === GUEST ? null : owner)
  return loadHistory(owner)
    .flatMap((progress) => {
      const story = stories.get(progress.slug)
      return story ? [{ story, progress }] : []
    })
    .slice(0, limit)
}

/** Chỗ đọc dở của một truyện; null nếu chưa đọc */
export async function getStoryProgress(slug: string): Promise<ReadingProgress | null> {
  await delay(100)
  const owner = await historyOwner()
  return loadHistory(owner).find((p) => p.slug === slug) ?? null
}

/**
 * Ghi chỗ đang đọc: gọi khi mở chương (progress bỏ trống: giữ vị trí cũ nếu cùng chương)
 * và khi cuộn. Truyện được đưa lên đầu lịch sử; nếu đang theo dõi thì nâng mốc "đã thấy".
 */
export async function saveReadingProgress(input: ProgressInput): Promise<ReadingProgress> {
  const owner = await historyOwner()
  const { entry, history } = addToHistory(loadHistory(owner), input)
  saveHistory(owner, history)

  if (owner !== GUEST) {
    const follows = loadFollows(owner)
    const followed = follows.find((e) => e.slug === input.slug)
    if (followed && (followed.seenChapter ?? 0) < input.chapter) {
      saveFollows(
        owner,
        follows.map((e) => (e === followed ? { ...e, seenChapter: input.chapter } : e)),
      )
    }
  }
  return entry
}

export async function removeFromHistory(slug: string) {
  await delay(200)
  const owner = await historyOwner()
  saveHistory(
    owner,
    loadHistory(owner).filter((p) => p.slug !== slug),
  )
}

export async function clearHistory() {
  await delay(300)
  saveHistory(await historyOwner(), [])
}

/** Bản giả ghi thẳng vào localStorage nên không có gì chờ gửi */
export async function syncPendingProgress(): Promise<number> {
  return 0
}
