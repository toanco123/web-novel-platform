// Hộp thông báo giả (localStorage, mocks/notifications.ts): dùng cho test tự động và khi chạy không có
// Supabase (xem api.ts). Các api giả khác ghi thông báo bằng addNotification (bình luận, duyệt truyện).
// Bản thật: api.remote.ts.
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { paginate } from '@/lib/pagination'
import { loadNotifications, saveNotifications } from '@/mocks/notifications'
import type { AppNotification } from './shared'

const toNotification = (n: ReturnType<typeof loadNotifications>[number]): AppNotification => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  link: n.link,
  createdAt: n.createdAt,
  read: n.readAt !== null,
})

export async function getNotifications(page: number, perPage: number) {
  await delay()
  const me = (await requireUser()).id
  const page_ = paginate(loadNotifications(me), page, perPage)
  return { ...page_, items: page_.items.map(toNotification) }
}

export async function getUnreadNotificationCount() {
  await delay()
  const me = (await requireUser()).id
  return loadNotifications(me).filter((n) => n.readAt === null).length
}

export async function markNotificationsRead(ids: string[]) {
  await delay()
  const me = (await requireUser()).id
  const now = new Date().toISOString()
  saveNotifications(
    me,
    loadNotifications(me).map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n)),
  )
}

export async function markAllNotificationsRead() {
  await delay()
  const me = (await requireUser()).id
  const now = new Date().toISOString()
  saveNotifications(
    me,
    loadNotifications(me).map((n) => (n.readAt ? n : { ...n, readAt: now })),
  )
}

export async function deleteNotification(id: string) {
  await delay()
  const me = (await requireUser()).id
  saveNotifications(
    me,
    loadNotifications(me).filter((n) => n.id !== id),
  )
}
