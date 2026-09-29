import { App, ConfigProvider, Grid, Layout, Menu } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { ArrowLeft, BookOpen, Flag, Inbox, LayoutDashboard, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { SITE_NAME } from '@/config/site'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { useTheme } from '@/hooks/useTheme'
import { paths } from '@/lib/routes'
import type { User } from '@/types/user'
import { adminThemeConfig } from './adminTheme'

const menu = [
  { key: paths.admin, icon: LayoutDashboard, label: 'Tổng quan' },
  { key: paths.adminUsers, icon: Users, label: 'Người dùng' },
  { key: paths.adminStories(), icon: BookOpen, label: 'Truyện' },
  { key: paths.adminInbox, icon: Inbox, label: 'Hộp thư' },
  { key: paths.adminReports, icon: Flag, label: 'Báo lỗi' },
]

/** Khung trang quản trị: menu bên trái (màn rộng) hoặc trên đầu (màn hẹp), theo theme của web */
export function AdminLayout({ user, children }: { user: User; children: ReactNode }) {
  const theme = useTheme((s) => s.theme)
  const { pathname } = useLocation()
  const wide = Grid.useBreakpoint().lg ?? false

  const items = menu.map(({ key, icon: Icon, label }) => ({
    key,
    icon: <Icon className="size-4" aria-hidden />,
    label: <Link to={key}>{label}</Link>,
  }))
  // Màn hẹp: dải tab cuộn ngang (Menu ngang của antd sẽ giấu các mục cuối vào "···")
  const nav = wide ? (
    <Menu mode="inline" selectedKeys={[pathname]} items={items} className="border-none!" />
  ) : (
    <ul className="relative flex overflow-x-auto">
      {menu.map(({ key, icon: Icon, label }) => (
        <li key={key}>
          <Link
            to={key}
            aria-current={pathname === key ? 'page' : undefined}
            className="flex items-center justify-center gap-1.5 border-b-2 border-transparent px-4 py-3 text-sm whitespace-nowrap text-muted-foreground aria-[current=page]:border-primary aria-[current=page]:font-medium aria-[current=page]:text-foreground"
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <ConfigProvider locale={viVN} theme={adminThemeConfig(theme)}>
      <App>
        {/* Style của antd không nằm trong @layer nên thắng class Tailwind (min-height: 0) */}
        <Layout style={{ minHeight: '100svh' }}>
          {wide && (
            <Layout.Sider width={220} className="border-r border-border">
              <div className="flex h-16 items-center px-6">
                <Link to={paths.admin} className="font-heading text-2xl font-semibold">
                  Quản trị
                </Link>
              </div>
              <nav aria-label="Quản trị">{nav}</nav>
            </Layout.Sider>
          )}
          <Layout>
            <Layout.Header className="flex items-center gap-2 border-b border-border">
              {!wide && (
                <Link to={paths.admin} className="font-heading text-xl font-semibold">
                  Quản trị
                </Link>
              )}
              <Link
                to={paths.home}
                className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span className="hidden sm:inline">Về {SITE_NAME}</span>
                <span className="sm:hidden">Về web</span>
              </Link>
              <ThemeToggle />
              <span className="flex items-center gap-2 text-sm">
                <UserAvatar user={user} className="size-8" />
                <span className="hidden max-w-40 truncate md:inline">{user.displayName}</span>
              </span>
            </Layout.Header>
            {!wide && (
              <nav aria-label="Quản trị" className="border-b border-border bg-card">
                {nav}
              </nav>
            )}
            <Layout.Content className="mx-auto w-full max-w-7xl p-4 sm:p-6">
              {children}
            </Layout.Content>
          </Layout>
        </Layout>
      </App>
    </ConfigProvider>
  )
}
