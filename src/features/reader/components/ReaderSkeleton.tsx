import { Skeleton } from '@/components/ui/skeleton'
import { widths } from '../readerOptions'
import { useReaderSettings } from '../useReaderSettings'

/**
 * Nội dung chương đang tải: cùng bề rộng chữ người đọc đã chọn để chữ không nhảy khi hiện ra.
 * `inline`: chỉ phần chữ, đặt trong vùng nội dung của trang đọc (đã có lề và bề rộng)
 */
export function ReaderSkeleton({ inline = false }: { inline?: boolean }) {
  const width = useReaderSettings((s) => s.width)
  const lines = (
    <>
      <Skeleton className="mx-auto h-4 w-40" />
      <Skeleton className="mx-auto mt-6 h-10 w-3/4" />
      <div className="mt-14 space-y-3">
        {Array.from({ length: 14 }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: i % 5 === 4 ? '60%' : '100%' }} />
        ))}
      </div>
    </>
  )
  if (inline) {
    return (
      <div aria-busy aria-label="Đang tải chương">
        {lines}
      </div>
    )
  }
  return (
    <div
      className="mx-auto px-5 pt-24 pb-20 sm:px-8 sm:pt-28"
      style={{ maxWidth: `calc(${widths.find((w) => w.value === width)?.maxWidth} + 4rem)` }}
      aria-busy
      aria-label="Đang tải chương"
    >
      {lines}
    </div>
  )
}

/** Thanh công cụ lúc mở trang đọc lần đầu, chưa có chương nào để hiện tên truyện và nút */
export function ReaderToolbarSkeleton() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl supports-backdrop-filter:bg-background/70"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:px-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5 px-1">
          <Skeleton className="h-3.5 w-40 max-w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="size-10 rounded-full" />
        ))}
      </div>
    </div>
  )
}
