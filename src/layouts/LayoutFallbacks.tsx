// Hiện khi mở thẳng một trang mà code của trang chưa tải xong (HydrateFallback của router): giữ khung
// của layout thay cho vòng xoay toàn màn hình, nối liền với khung tĩnh trong index.html
import { Container } from '@/components/common/Container'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { SiteLogo } from '@/components/common/SiteLogo'
import { Skeleton } from '@/components/ui/skeleton'
import { ReaderSkeleton } from '@/features/reader/components/ReaderSkeleton'
import { toneClass } from '@/features/reader/readerOptions'
import { useReaderSettings } from '@/features/reader/useReaderSettings'
import { cn } from '@/lib/utils'

export function MainLayoutFallback() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <HeaderSkeleton />
      <main className="flex-1">
        <PageSkeleton />
      </main>
    </div>
  )
}

/**
 * Header lúc chờ: chỉ logo và khung, không có ô tìm kiếm hay menu thật (header thật thay vào khi
 * trang sẵn sàng; gõ dở vào ô tìm kiếm ở đây sẽ mất)
 */
function HeaderSkeleton() {
  return (
    <div className="border-b border-border/70">
      <Container className="flex h-16 items-center gap-3">
        <SiteLogo />
        <Skeleton className="mx-auto hidden h-10 w-full max-w-md rounded-full md:block" />
        <Skeleton className="ml-auto size-9 rounded-full md:ml-0" />
        <Skeleton className="size-9 rounded-full" />
      </Container>
      <Container className="hidden h-12 items-center gap-1.5 lg:flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </Container>
    </div>
  )
}

export function ReaderLayoutFallback() {
  const tone = useReaderSettings((s) => s.tone)
  return (
    <div className={cn(toneClass[tone], 'min-h-svh bg-background text-foreground')}>
      <ReaderSkeleton />
    </div>
  )
}

export function AuthLayoutFallback() {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <div className="hidden bg-[#1a0f1d] lg:block" />
      <div
        className="mx-auto w-full max-w-md space-y-4 px-4 pt-28"
        aria-busy
        aria-label="Đang tải trang"
      >
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-6 h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    </div>
  )
}
