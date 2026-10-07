// Chặn người dùng giả (localStorage, mocks/activity.ts): dùng cho test tự động và khi chạy không có
// Supabase (xem api.ts). Bình luận giả ẩn người đã chặn ở comments/api.mock.ts. Bản thật: api.remote.ts.
import { getProfiles, requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { loadBlocks, saveBlocks } from '@/mocks/activity'
import { type BlockedUser, cannotBlockSelf } from './shared'

export async function blockUser(userId: string) {
  await delay()
  const me = (await requireUser()).id
  if (userId === me) throw cannotBlockSelf()
  const entries = loadBlocks(me)
  if (entries.some((e) => e.userId === userId)) return
  saveBlocks(me, [{ userId, blockedAt: new Date().toISOString() }, ...entries])
}

export async function unblockUser(userId: string) {
  await delay()
  const me = (await requireUser()).id
  saveBlocks(
    me,
    loadBlocks(me).filter((e) => e.userId !== userId),
  )
}

const SEED_USER = 'seed-user-'

/** Người viết bình luận mẫu (id `seed-user-<tên>`) không có trong kho người dùng giả: lấy tên từ id */
const seedProfile = (id: string) => ({
  id,
  displayName: id.startsWith(SEED_USER) ? id.slice(SEED_USER.length) : 'Người dùng',
  avatarUrl: null,
})

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  await delay()
  const entries = loadBlocks((await requireUser()).id)
  const profiles = await getProfiles(entries.map((e) => e.userId))
  return entries.map((e) => ({
    user: profiles.get(e.userId) ?? seedProfile(e.userId),
    blockedAt: e.blockedAt,
  }))
}
