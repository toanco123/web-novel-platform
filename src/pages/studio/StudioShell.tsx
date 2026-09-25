import { Outlet } from 'react-router'
import { Container } from '@/components/common/Container'
import { RequireAuth } from '@/components/common/RequireAuth'

/** Khung chung cho mọi trang /sang-tac: bắt buộc đăng nhập */
export default function StudioShell() {
  return (
    <RequireAuth>
      <Container className="py-8 lg:py-10">
        <Outlet />
      </Container>
    </RequireAuth>
  )
}
