import { CalendarClock } from 'lucide-react'
import { formatScheduleTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { NextChapter } from '@/types/story'
import { upcomingChapter } from './shared'

/**
 * "Chương 12 ra lúc 20:00 thứ Sáu, 10/10": chương hẹn giờ sớm nhất của truyện. Giờ đã qua (cron chưa
 * kịp xuất bản) hoặc không có chương hẹn thì không hiện gì
 */
export function UpcomingChapter({
  next,
  className,
}: {
  next: NextChapter | null | undefined
  className?: string
}) {
  const upcoming = upcomingChapter(next)
  if (!upcoming) return null
  return (
    <p className={cn('flex items-center gap-1.5 text-sm', className)}>
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span>
        Chương {upcoming.number} ra lúc{' '}
        <time dateTime={upcoming.at}>{formatScheduleTime(upcoming.at)}</time>
      </span>
    </p>
  )
}
