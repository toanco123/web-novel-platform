import { Skeleton } from '@/components/ui/skeleton'

// Khung chờ của các trang Sáng tác, dựng theo đúng bố cục trang để nội dung hiện ra không bị nhảy

function BreadcrumbSkeleton() {
  return <Skeleton className="mb-3 h-4 w-56 max-w-full" />
}

/** Nhãn + ô nhập của form */
function FieldSkeleton({ className = 'h-11' }: { className?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className={className} />
    </div>
  )
}

/** Trang quản lý truyện: bìa + tên + nút xuất bản, hàng tab, danh sách chương */
export function ManageStorySkeleton() {
  return (
    <div aria-busy aria-label="Đang tải truyện">
      <BreadcrumbSkeleton />
      <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-5 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <Skeleton className="aspect-[2/3] rounded-lg" />
        <div className="min-w-0">
          <Skeleton className="h-9 w-3/4 max-w-md" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-10 flex gap-2 overflow-hidden">
        {['w-28', 'w-24', 'w-20', 'w-36'].map((w) => (
          <Skeleton key={w} className={`h-8 shrink-0 ${w}`} />
        ))}
      </div>
      <div className="mt-6">
        <ChapterListSkeleton />
      </div>
    </div>
  )
}

/** Danh sách chương trong tab "Chương" */
export function ChapterListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y rounded-xl border" aria-busy aria-label="Đang tải danh sách chương">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-6 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3 max-w-xs" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
          <Skeleton className="size-7 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

/** Trình soạn chương: tiêu đề trang, số + tên chương, ô nội dung */
export function ChapterEditorSkeleton() {
  return (
    <div aria-busy aria-label="Đang tải chương">
      <BreadcrumbSkeleton />
      <Skeleton className="h-10 w-64 max-w-full" />
      <Skeleton className="mt-2 mb-6 h-5 w-48" />
      <div className="max-w-3xl space-y-6">
        <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 rounded-b-none" />
          <Skeleton className="h-80 rounded-t-none" />
        </div>
      </div>
    </div>
  )
}

/** Trang nhập chương từ file: tiêu đề, đoạn hướng dẫn, ô kéo thả file */
export function ImportChaptersSkeleton() {
  return (
    <div aria-busy aria-label="Đang tải truyện">
      <BreadcrumbSkeleton />
      <Skeleton className="h-10 w-80 max-w-full" />
      <div className="mt-2 mb-8 max-w-prose space-y-2">
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-36 max-w-2xl rounded-xl" />
    </div>
  )
}

/** Form thông tin truyện (tạo truyện mới) */
export function StoryFormSkeleton() {
  return (
    <div
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]"
      aria-busy
      aria-label="Đang tải form"
    >
      <div className="space-y-6">
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton className="h-32" />
        <FieldSkeleton />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-64 rounded-full" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="hidden space-y-3 lg:block">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="aspect-[2/3] rounded-lg" />
      </div>
    </div>
  )
}
