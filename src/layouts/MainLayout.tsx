import { Outlet } from 'react-router'
import { Footer } from '@/components/common/Footer'
import { Header } from '@/components/common/Header'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { AppScrollRestoration } from '@/components/common/AppScrollRestoration'
import { AppBanner } from '@/features/appBanner/AppBanner'
import { NavigationProgress } from '@/components/common/NavigationProgress'

export function MainLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua điều hướng
      </a>
      <NavigationProgress />
      <Header />
      <OfflineBanner />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AppBanner />
      <AppScrollRestoration />
    </div>
  )
}
