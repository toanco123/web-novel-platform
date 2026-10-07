import { useEffect } from 'react'
import { setMonitoringUser } from '@/lib/monitoring'
import { useAuthSync, useSession } from '../hooks'

/**
 * Gắn một lần trong Providers để cache phiên theo kịp Supabase Auth, và gắn id người đăng nhập vào
 * lỗi gửi Sentry (chỉ id, không email hay tên)
 */
export function AuthSync() {
  useAuthSync()
  const userId = useSession().data?.id ?? null
  useEffect(() => setMonitoringUser(userId), [userId])
  return null
}
