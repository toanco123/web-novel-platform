import { cn } from '@/lib/utils'

export function StatusBadge({
  published,
  takenDown = false,
  className,
}: {
  published: boolean
  /** Truyện bị ban quản trị gỡ */
  takenDown?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        takenDown
          ? 'bg-destructive/15 text-destructive'
          : published
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {takenDown ? 'Bị gỡ' : published ? 'Đã xuất bản' : 'Nháp'}
    </span>
  )
}
