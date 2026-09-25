import { cn } from '@/lib/utils'

/** Thanh % đã đọc trong chương (chữ % đi kèm để không phụ thuộc màu) */
export function ProgressMeter({ value, className }: { value: number; className?: string }) {
  const percent = Math.round(value * 100)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  )
}
