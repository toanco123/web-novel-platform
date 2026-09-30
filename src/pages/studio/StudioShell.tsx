import { Outlet } from 'react-router'
import { Container } from '@/components/common/Container'
import { RequireAuth } from '@/components/common/RequireAuth'
import { NoIndex } from '@/components/common/Seo'

/** Khung chung cho mọi trang /studio: bắt buộc đăng nhập */
export default function StudioShell() {
  return (
    <RequireAuth>
      <Container className="py-8 lg:py-10">
        <NoIndex />
        <Outlet />
      </Container>
    </RequireAuth>
  )
}
