import { Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { Pagination } from '@/components/common/Pagination'
import { RequireAuth } from '@/components/common/RequireAuth'
import { SectionError } from '@/components/common/SectionHeading'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SITE_NAME } from '@/config/site'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/features/notifications/hooks'
import { NOTIFICATIONS_PAGE_SIZE } from '@/features/notifications/shared'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  return (
    <Container className="max-w-3xl py-10">
      <Seo title={`Thông báo | ${SITE_NAME}`} noindex />
      <RequireAuth fallback={<NotificationsSkeleton />}>
        <NotificationList />
      </RequireAuth>
    </Container>
  )
}

function NotificationsSkeleton() {
  return (
    <div aria-busy aria-label="Đang tải thông báo" className="space-y-3">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

function NotificationList() {
  const [params] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, isPending, isError, isPlaceholderData } = useNotifications(
    page,
    NOTIFICATIONS_PAGE_SIZE,
  )
  const { data: unread = 0 } = useUnreadNotificationCount()
  const markRead = useMarkNotificationsRead()
  const markAll = useMarkAllNotificationsRead()
  const remove = useDeleteNotification()

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl font-semibold">Thông báo</h1>
          <p className="mt-1 text-muted-foreground">
            Chương mới của truyện đang theo dõi, trả lời bình luận và kết quả duyệt truyện.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </div>
      <section aria-label="Danh sách thông báo" className="mt-6">
        {isError ? (
          <SectionError />
        ) : isPending ? (
          <Skeleton className="h-96 rounded-2xl" />
        ) : data.total === 0 ? (
          <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            Chưa có thông báo nào.
          </p>
        ) : (
          <>
            <ul
              aria-busy={isPlaceholderData}
              className={cn(
                'space-y-1 rounded-2xl border bg-card p-2',
                isPlaceholderData && 'opacity-60',
              )}
            >
              {data.items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onOpen={(item) => {
                    if (!item.read) markRead.mutate([item.id])
                  }}
                  action={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-2 mr-2 shrink-0 text-muted-foreground"
                      aria-label={`Xóa thông báo: ${n.title}`}
                      disabled={remove.isPending && remove.variables === n.id}
                      onClick={() => remove.mutate(n.id)}
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              ))}
            </ul>
            <Pagination
              page={data.page}
              pageCount={data.pageCount}
              searchFor={(p) => (p > 1 ? `?page=${p}` : '?')}
              label="Phân trang thông báo"
              preventScrollReset
            />
          </>
        )}
      </section>
    </>
  )
}
