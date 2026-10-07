import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { Container } from './Container'

/**
 * Trang cần đăng nhập: chưa đăng nhập thì chuyển sang đăng nhập rồi quay lại đúng chỗ.
 * `fallback`: khung chờ lúc chưa biết phiên (mặc định tiêu đề + vài khối, nằm gọn trong layout)
 */
export function RequireAuth({
  children,
  fallback = <PrivatePageSkeleton />,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { data: user, isPending } = useSession()
  const current = useCurrentPath()
  if (isPending) return fallback
  if (!user) return <Navigate to={paths.login(current)} replace />
  return children
}

/** Trang riêng tư đang chờ phiên: không cao cả màn hình để footer không bị đẩy xuống */
function PrivatePageSkeleton() {
  return (
    <Container className="space-y-4 py-10" aria-busy aria-label="Đang tải trang">
      <Skeleton className="h-10 w-56 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="mt-8 h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </Container>
  )
}
