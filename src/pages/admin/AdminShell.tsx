import { Outlet } from 'react-router'
import { NotFound } from '@/components/common/NotFound'
import { RequireAuth } from '@/components/common/RequireAuth'
import { AdminLayout } from '@/features/admin/components/AdminLayout'
import { useSession } from '@/features/auth/hooks'

/** Khung chung cho mọi trang /admin: bắt buộc đăng nhập và là quản trị viên */
export default function AdminShell() {
  return (
    <RequireAuth>
      <AdminGate />
    </RequireAuth>
  )
}

function AdminGate() {
  const { data: user } = useSession()
  // Người thường thấy như trang không tồn tại (không tiết lộ có trang quản trị)
  if (!user?.isAdmin) {
    return (
      <main className="min-h-svh bg-background">
        <NotFound />
      </main>
    )
  }
  return (
    <AdminLayout user={user}>
      <Outlet />
    </AdminLayout>
  )
}
