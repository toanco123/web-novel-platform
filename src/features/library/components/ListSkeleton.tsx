import { Skeleton } from '@/components/ui/skeleton'

/** Danh sách truyện đang tải (tủ truyện, lịch sử đọc, chương đã lưu): bìa nhỏ + hai dòng chữ */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y rounded-xl border" aria-busy aria-label="Đang tải danh sách">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 p-4">
          <Skeleton className="aspect-[2/3] w-14 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
