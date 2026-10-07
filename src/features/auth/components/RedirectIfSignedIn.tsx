import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '../hooks'
import { useAuthRedirect } from '../useAuthRedirect'

/** Trang đăng nhập/đăng ký: đã đăng nhập rồi thì chuyển thẳng tới ?next= */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession()
  const { next } = useAuthRedirect()
  if (isPending) return <AuthFormSkeleton />
  if (user) return <Navigate to={next} replace />
  return children
}

/** Đang chờ phiên: khung form (tiêu đề + ô nhập) ở đúng chỗ form sẽ hiện, không vòng xoay */
function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Đang tải trang">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="mt-6 h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  )
}
