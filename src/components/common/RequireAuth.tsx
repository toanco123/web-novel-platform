import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useSession } from '@/features/auth/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { PageLoader } from './PageLoader'

/** Trang cần đăng nhập: chưa đăng nhập thì chuyển sang đăng nhập rồi quay lại đúng chỗ */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession()
  const current = useCurrentPath()
  if (isPending) return <PageLoader />
  if (!user) return <Navigate to={paths.login(current)} replace />
  return children
}
