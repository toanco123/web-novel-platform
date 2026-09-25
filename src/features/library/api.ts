// Nơi DUY NHẤT xử lý tủ truyện. Giai đoạn UI lưu localStorage theo user (key mock-library).
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay, readMock, writeMock } from '@/lib/mockStorage'

const KEY = 'mock-library'
type Library = Record<string, string[]>

const load = () => readMock<Library>(KEY, {})

export async function getFollowStatus(slug: string): Promise<boolean> {
  await delay(100)
  const user = await requireUser()
  return (load()[user.id] ?? []).includes(slug)
}

async function setFollow(slug: string, follow: boolean) {
  await delay()
  const user = await requireUser()
  const library = load()
  const slugs = new Set(library[user.id] ?? [])
  if (follow) slugs.add(slug)
  else slugs.delete(slug)
  writeMock(KEY, { ...library, [user.id]: [...slugs] })
  return follow
}

export const followStory = (slug: string) => setFollow(slug, true)
export const unfollowStory = (slug: string) => setFollow(slug, false)
