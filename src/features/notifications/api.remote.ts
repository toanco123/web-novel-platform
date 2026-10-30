// Hộp thông báo trên Supabase. Bảng notifications (chỉ private.notify ghi; chủ đọc, đánh dấu đã đọc
// và xóa dòng của mình) ở migration 20261030071758_notifications.sql; mục 3, 5 thiet-ke-database.md.
import { requireUserId } from '@/features/auth/api'
import { unwrap } from '@/lib/dbError'
import { loadPage } from '@/lib/dbPage'
import { db } from '@/lib/supabase'
import type { Page } from '@/types/page'
import { type AppNotification, isNotificationType } from './shared'

const COLUMNS = 'id, type, title, body, link, created_at, read_at'

/** Một trang thông báo của mình, mới nhất trước (RLS đã lọc theo chủ) */
export async function getNotifications(
  page: number,
  perPage: number,
): Promise<Page<AppNotification>> {
  await requireUserId()
  const result = await loadPage(page, perPage, (from, to) =>
    db()
      .from('notifications')
      .select(COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )
  return {
    ...result,
    items: result.items.flatMap((row) =>
      // Loại lạ (bản web cũ, DB mới thêm loại): bỏ qua thay vì hiện sai
      isNotificationType(row.type)
        ? [
            {
              id: String(row.id),
              type: row.type,
              title: row.title,
              body: row.body,
              link: row.link,
              createdAt: row.created_at,
              read: row.read_at !== null,
            },
          ]
        : [],
    ),
  }
}

export async function getUnreadNotificationCount() {
  await requireUserId()
  const { count, error } = await db()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationsRead(ids: string[]) {
  await requireUserId()
  if (ids.length === 0) return
  unwrap(
    await db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids.map(Number))
      .is('read_at', null),
  )
}

export async function markAllNotificationsRead() {
  await requireUserId()
  unwrap(
    await db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null),
  )
}

export async function deleteNotification(id: string) {
  await requireUserId()
  unwrap(await db().from('notifications').delete().eq('id', Number(id)))
}
