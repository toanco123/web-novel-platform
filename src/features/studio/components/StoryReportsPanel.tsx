import { CircleCheck, Flag, RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { reportReasons } from '@/features/feedback/schemas'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { ChapterReport } from '@/types/report'
import { studioErrorMessage } from '../errors'
import { useSetReportStatus, useStoryReports } from '../hooks'

const reasonLabel = (reason: ChapterReport['reason']) =>
  reportReasons.find((r) => r.value === reason)?.label ?? reason

/** Báo lỗi chương bạn đọc gửi cho truyện này; chưa xử lý xếp trước */
export function StoryReportsPanel({ storyId }: { storyId: string }) {
  const { data, isPending, isError } = useStoryReports(storyId)
  const setStatus = useSetReportStatus(storyId)

  if (isError) return <SectionError />
  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <Flag className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-2 font-medium">Chưa có báo lỗi nào</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bạn đọc bấm “Báo lỗi chương” ở cuối chương thì báo lỗi sẽ hiện ở đây.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {setStatus.isError && <FormAlert>{studioErrorMessage(setStatus.error)}</FormAlert>}
      <ul className="divide-y rounded-xl border bg-card/40" aria-label="Báo lỗi chương">
        {data.map((r) => {
          const resolved = r.status === 'resolved'
          return (
            <li
              key={r.id}
              className={cn(
                'grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start',
                resolved && 'opacity-60',
              )}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    to={paths.studioChapter(storyId, r.chapterNumber)}
                    className="font-medium hover:text-primary"
                  >
                    Chương {r.chapterNumber}
                  </Link>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    {reasonLabel(r.reason)}
                  </span>
                  {resolved && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                      <CircleCheck className="size-3.5" aria-hidden />
                      Đã xử lý
                    </span>
                  )}
                </p>
                {r.note && (
                  <p className="mt-1.5 text-sm break-words whitespace-pre-line">{r.note}</p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {r.reporter.displayName},{' '}
                  <time dateTime={r.createdAt}>{formatRelativeTime(r.createdAt)}</time>
                </p>
              </div>
              <Button
                variant={resolved ? 'ghost' : 'outline'}
                size="sm"
                className="justify-self-start rounded-full"
                disabled={setStatus.isPending}
                onClick={() =>
                  setStatus.mutate({ id: r.id, status: resolved ? 'open' : 'resolved' })
                }
              >
                {resolved ? <RotateCcw /> : <CircleCheck />}
                {resolved ? 'Mở lại' : 'Đã xử lý'}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
