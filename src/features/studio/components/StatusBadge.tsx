import { cn } from '@/lib/utils'

export function StatusBadge({ published, className }: { published: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        published
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {published ? 'Đã xuất bản' : 'Nháp'}
    </span>
  )
}
