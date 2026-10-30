// Phần dùng chung của hai backend hộp thông báo (api.mock.ts, api.remote.ts)
export const NOTIFICATION_TYPES = [
  'chapter.new',
  'comment.reply',
  'comment.story',
  'story.approved',
  'story.rejected',
  'story.takedown',
  'story.restored',
  'announcement',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  body: string
  /** Đường dẫn trong web; null: không bấm được */
  link: string | null
  createdAt: string
  read: boolean
}

/** Số thông báo mỗi trang ở trang `/notifications` */
export const NOTIFICATIONS_PAGE_SIZE = 20
/** Số thông báo trong popover của chuông */
export const NOTIFICATIONS_PREVIEW_SIZE = 8

/** Chỉ mở đường dẫn nội bộ (`/...`, không phải `//host`): thông báo do hệ thống ghi nhưng vẫn kiểm */
export function safeNotificationLink(link: string | null) {
  return link && link.startsWith('/') && !link.startsWith('//') ? link : null
}

/** Huy hiệu số chưa đọc: tối đa "99+" */
export const unreadLabel = (count: number) => (count > 99 ? '99+' : String(count))

export const isNotificationType = (value: string): value is NotificationType =>
  (NOTIFICATION_TYPES as readonly string[]).includes(value)
