import { Outlet } from 'react-router'
import { Footer } from '@/components/common/Footer'
import { Header } from '@/components/common/Header'
import { AppScrollRestoration } from '@/components/common/AppScrollRestoration'

export function MainLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua điều hướng
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AppScrollRestoration />
    </div>
  )
}
