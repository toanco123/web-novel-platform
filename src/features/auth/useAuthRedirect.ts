import { useNavigate, useSearchParams } from 'react-router'
import { safeNext } from './safeNext'

/** Đích đến sau khi đăng nhập/đăng ký, lấy từ ?next= (đã lọc chống open redirect) */
export function useAuthRedirect() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))
  return { next, goNext: () => navigate(next, { replace: true }) }
}
