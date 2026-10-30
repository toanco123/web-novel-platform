import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useSession } from '@/features/auth/hooks'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../hooks'
import { NOTIFICATIONS_PREVIEW_SIZE, unreadLabel } from '../shared'
import { NotificationItem } from './NotificationItem'

/**
 * Chuông thông báo trên header (chỉ khi đã đăng nhập), kèm số chưa đọc. Từ màn `sm` mở popover với
 * các thông báo mới nhất; điện thoại bấm thẳng sang trang `/notifications`.
 */
export function NotificationBell() {
  const { data: user } = useSession()
  const { data: unread = 0 } = useUnreadNotificationCount()
  const wide = useMediaQuery('(min-width: 40rem)')
  const [open, setOpen] = useState(false)
  if (!user) return null

  const label = unread > 0 ? `Thông báo (${unreadLabel(unread)} chưa đọc)` : 'Thông báo'
  const icon = (
    <>
      <Bell />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full bg-neon px-1 text-[0.625rem] leading-4.5 font-bold text-background ring-2 ring-background"
        >
          {unreadLabel(unread)}
        </span>
      )}
    </>
  )
  const button = 'relative rounded-full'

  if (!wide) {
    return (
      <Button variant="ghost" size="icon-lg" asChild className={button}>
        <Link to={paths.notifications} aria-label={label} title="Thông báo">
          {icon}
        </Link>
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={label}
          title="Thông báo"
          className={button}
        >
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[26rem] max-w-[calc(100vw-2rem)] gap-0 rounded-3xl border bg-card p-3 shadow-2xl ring-0"
      >
        <BellPanel unread={unread} onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

function BellPanel({ unread, onNavigate }: { unread: number; onNavigate: () => void }) {
  const { data, isPending, isError } = useNotifications(1, NOTIFICATIONS_PREVIEW_SIZE)
  const markRead = useMarkNotificationsRead()
  const markAll = useMarkAllNotificationsRead()

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
        <h2 className="font-heading text-xl font-semibold">Thông báo</h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </div>
      {isError ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Không tải được thông báo. Thử lại sau.
        </p>
      ) : isPending ? (
        <p className="p-6 text-center text-sm text-muted-foreground" aria-busy>
          Đang tải thông báo...
        </p>
      ) : data.items.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
      ) : (
        <ul className={cn('max-h-[60svh] overflow-y-auto')}>
          {data.items.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onOpen={(item) => {
                if (!item.read) markRead.mutate([item.id])
                onNavigate()
              }}
            />
          ))}
        </ul>
      )}
      <Link
        to={paths.notifications}
        onClick={onNavigate}
        className="mt-1 block rounded-xl py-2.5 text-center text-sm font-medium text-rose-gold hover:bg-muted/60"
      >
        Xem tất cả
      </Link>
    </div>
  )
}
