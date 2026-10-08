import { formatScheduleShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ReviewStatus } from '@/types/story'

export function StatusBadge({
  published,
  takenDown = false,
  review = null,
  scheduledAt = null,
  className,
}: {
  published: boolean
  /** Chương nháp đang hẹn giờ: hiện "Hẹn 20:00 · T6, 10/10" */
  scheduledAt?: string | null
  /** Truyện bị ban quản trị gỡ */
  takenDown?: boolean
  /** Trạng thái duyệt của truyện (chỉ hiện khi truyện chưa xuất bản) */
  review?: ReviewStatus | null
  className?: string
}) {
  const [label, tone] = takenDown
    ? ['Bị gỡ', 'bg-destructive/15 text-destructive']
    : published
      ? ['Đã xuất bản', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300']
      : scheduledAt
        ? [
            `Hẹn ${formatScheduleShort(scheduledAt)}`,
            'bg-sky-500/15 text-sky-700 dark:text-sky-300',
          ]
        : review === 'pending'
          ? ['Chờ duyệt', 'bg-amber-500/15 text-amber-700 dark:text-amber-300']
          : review === 'rejected'
            ? ['Bị từ chối', 'bg-destructive/15 text-destructive']
            : ['Nháp', 'bg-muted text-muted-foreground']
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
    >
      {label}
    </span>
  )
}
