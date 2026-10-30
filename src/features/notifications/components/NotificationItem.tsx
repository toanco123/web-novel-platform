import {
  BadgeCheck,
  BookOpen,
  Ban,
  Megaphone,
  MessageCircle,
  Reply,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type AppNotification, type NotificationType, safeNotificationLink } from '../shared'

const icons: Record<NotificationType, LucideIcon> = {
  'chapter.new': BookOpen,
  'comment.reply': Reply,
  'comment.story': MessageCircle,
  'story.approved': BadgeCheck,
  'story.rejected': XCircle,
  'story.takedown': Ban,
  'story.restored': RotateCcw,
  announcement: Megaphone,
}

type Props = {
  notification: AppNotification
  /** Bấm vào thông báo (đánh dấu đã đọc, đóng popover) */
  onOpen?: (notification: AppNotification) => void
  /** Nút bên phải (xóa) ở trang danh sách */
  action?: ReactNode
}

/** Một dòng thông báo: link tới nội dung nếu có, chấm màu khi chưa đọc */
export function NotificationItem({ notification, onOpen, action }: Props) {
  const Icon = icons[notification.type]
  const link = safeNotificationLink(notification.link)
  const content = (
    <>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-rose-gold"
      >
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug', !notification.read && 'font-semibold')}>
          {notification.title}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
            {notification.body}
          </span>
        )}
        <time
          dateTime={notification.createdAt}
          title={formatDate(notification.createdAt)}
          className="mt-1 block text-xs text-muted-foreground"
        >
          {formatRelativeTime(notification.createdAt)}
        </time>
      </span>
      {!notification.read && (
        <span className="mt-1 flex shrink-0 items-center" role="img" aria-label="Chưa đọc">
          <span className="size-2.5 rounded-full bg-neon" />
        </span>
      )}
    </>
  )
  const row = 'flex min-w-0 flex-1 items-start gap-3 rounded-xl p-3 text-left'

  return (
    <li className="flex items-start gap-1 rounded-xl hover:bg-muted/60">
      {link ? (
        <Link to={link} onClick={() => onOpen?.(notification)} className={row}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={() => onOpen?.(notification)} className={row}>
          {content}
        </button>
      )}
      {action}
    </li>
  )
}
