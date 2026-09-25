import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { PageLoader } from '@/components/common/PageLoader'
import { useSession } from '../hooks'
import { useAuthRedirect } from '../useAuthRedirect'

/** Trang đăng nhập/đăng ký: đã đăng nhập rồi thì chuyển thẳng tới ?next= */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession()
  const { next } = useAuthRedirect()
  if (isPending) return <PageLoader />
  if (user) return <Navigate to={next} replace />
  return children
}
