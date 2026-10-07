import { Skeleton } from '@/components/ui/skeleton'
import { Container } from './Container'

/** Trang đang tải (chưa biết là trang nào): khối lớn, tiêu đề, một hàng bìa truyện */
export function PageSkeleton() {
  return (
    <Container className="space-y-5 py-8" aria-busy aria-label="Đang tải trang">
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
        ))}
      </div>
    </Container>
  )
}
