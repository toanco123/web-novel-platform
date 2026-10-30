// Thông báo giả của từng người (localStorage `mock-notifications`, mới nhất trước), do các api giả
// khác ghi qua addNotification như private.notify ở DB thật. Chương mới chưa có trong bản giả.
import { readMock, writeMock } from '@/lib/mockStorage'
import type { NotificationType } from '@/features/notifications/shared'

const KEY = 'mock-notifications'
/** Như DB: thông báo quá 90 ngày bị dọn khi có thông báo mới */
const KEEP_MS = 90 * 24 * 60 * 60 * 1000

export type StoredNotification = {
  id: string
  type: NotificationType
  title: string
  body: string
  link: string | null
  createdAt: string
  readAt: string | null
}

const loadAll = () => readMock<Record<string, StoredNotification[]>>(KEY, {})

export const loadNotifications = (userId: string) => loadAll()[userId] ?? []

export function saveNotifications(userId: string, entries: StoredNotification[]) {
  const { [userId]: _old, ...rest } = loadAll()
  writeMock(KEY, entries.length ? { ...rest, [userId]: entries } : rest)
}

export function addNotification(
  userId: string,
  n: { type: NotificationType; title: string; body?: string; link?: string | null },
) {
  const cutoff = Date.now() - KEEP_MS
  saveNotifications(userId, [
    {
      id: crypto.randomUUID(),
      type: n.type,
      title: n.title.slice(0, 120),
      body: (n.body ?? '').slice(0, 300),
      link: n.link ?? null,
      createdAt: new Date().toISOString(),
      readAt: null,
    },
    ...loadNotifications(userId).filter((e) => Date.parse(e.createdAt) > cutoff),
  ])
}
