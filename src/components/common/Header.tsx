import {
  BookMarked,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  PenLine,
  Search,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { UpdateBadge, UserMenu } from '@/features/auth/components/UserMenu'
import { useSession, useSignOut } from '@/features/auth/hooks'
import { useGenres } from '@/features/genres/hooks'
import { useLibraryUpdateCount } from '@/features/library/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { Container } from './Container'
import { navItems } from './navItems'
import { SearchBox } from './SearchBox'
import { SiteLogo } from './SiteLogo'
import { ThemeToggle } from './ThemeToggle'

const pill =
  'inline-flex h-9 items-center gap-1 rounded-full px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40'
const pillIdle = 'text-muted-foreground hover:bg-muted hover:text-foreground'
const pillActive = 'bg-primary/12 text-primary ring-1 ring-primary/30'

export function Header() {
  const { data: genres } = useGenres()

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      <Container className="flex h-16 items-center gap-3">
        <MobileNav />
        <SiteLogo />
        <SearchBox className="mx-auto hidden w-full max-w-md md:block" />
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Button variant="ghost" size="icon-lg" className="md:hidden" asChild>
            <Link to={paths.search()} aria-label="Tìm kiếm">
              <Search />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="hidden h-9 rounded-full px-3 text-rose-gold hover:text-rose-gold md:inline-flex"
          >
            <Link to={paths.studioNewStory()} aria-label="Đăng truyện" title="Đăng truyện">
              <PenLine />
              <span className="hidden lg:inline">Đăng truyện</span>
            </Link>
          </Button>
          <ThemeToggle />
          <AccountSlot />
        </div>
      </Container>

      <nav aria-label="Điều hướng chính" className="hidden lg:block">
        <Container className="flex h-12 items-center gap-1.5">
          {navItems.slice(0, 3).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(pill, isActive ? pillActive : pillIdle)}
            >
              {item.label}
            </NavLink>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(pill, pillIdle, 'data-[state=open]:bg-muted')}>
              Thể loại
              <ChevronDown className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="grid w-80 grid-cols-2 gap-0.5 p-2">
              {genres?.slice(0, 12).map((g) => (
                <DropdownMenuItem key={g.slug} asChild>
                  <Link to={paths.genre(g.slug)}>{g.name}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                asChild
                className="col-span-2 mt-1 justify-center border-t pt-2 text-rose-gold"
              >
                <Link to={paths.genres}>Xem tất cả thể loại</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {navItems.slice(3).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(pill, isActive ? pillActive : pillIdle)}
            >
              {item.label}
            </NavLink>
          ))}
        </Container>
      </nav>
    </header>
  )
}

function AccountSlot() {
  const { data: user, isPending } = useSession()
  const current = useCurrentPath()

  // Giữ chỗ cùng kích thước để header không giật khi phiên đang tải
  if (isPending) return <span className="ml-1 size-9 animate-pulse rounded-full bg-muted" />
  if (user) return <UserMenu user={user} />
  return (
    <Button
      asChild
      variant="outline"
      className="ml-1 size-9 rounded-full border-rose-gold/50 text-rose-gold hover:border-rose-gold hover:text-rose-gold sm:w-auto sm:px-4"
    >
      <Link to={paths.login(current)} aria-label="Đăng nhập">
        <LogIn className="sm:hidden" aria-hidden />
        <span className="hidden sm:inline">Đăng nhập</span>
      </Link>
    </Button>
  )
}

function MobileNav() {
  const [open, setOpen] = useState(false)
  const { data: genres } = useGenres()
  const { data: user } = useSession()
  const { data: updates = 0 } = useLibraryUpdateCount()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const current = useCurrentPath()
  const close = () => setOpen(false)
  const menuLink =
    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ' + pillIdle

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="-ml-2 lg:hidden" aria-label="Mở menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-80 overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="font-normal">
            <SiteLogo />
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          {user ? (
            <div className="space-y-1 rounded-xl border p-2">
              <div className="flex items-center gap-3 px-2 py-2">
                <UserAvatar user={user} className="size-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Link to={paths.library} onClick={close} className={menuLink}>
                <BookMarked className="size-4" aria-hidden />
                Tủ truyện
                <UpdateBadge count={updates} />
              </Link>
              <Link to={paths.studio} onClick={close} className={menuLink}>
                <PenLine className="size-4" aria-hidden />
                Sáng tác
              </Link>
              <Link to={paths.account} onClick={close} className={menuLink}>
                <UserRound className="size-4" aria-hidden />
                Tài khoản
              </Link>
              <button
                type="button"
                disabled={signOut.isPending}
                onClick={() =>
                  signOut.mutate(undefined, {
                    onSuccess: () => {
                      close()
                      navigate(paths.home)
                    },
                  })
                }
                className={cn(menuLink, 'w-full')}
              >
                <LogOut className="size-4" aria-hidden />
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button asChild className="h-10 rounded-lg">
                <Link to={paths.login(current)} onClick={close}>
                  Đăng nhập
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-lg">
                <Link to={paths.register(current)} onClick={close}>
                  Tạo tài khoản
                </Link>
              </Button>
            </div>
          )}
          <Button asChild variant="outline" className="h-10 rounded-lg">
            <Link to={paths.studioNewStory()} onClick={close}>
              <PenLine />
              Đăng truyện
            </Link>
          </Button>
          <SearchBox onNavigate={close} showGenreHints={false} />
          <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
            {navItems.map((item) => (
              // Không bọc SheetClose: Slot sẽ ghép đè className dạng hàm của NavLink
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={close}
                className={({ isActive }) =>
                  cn('rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? pillActive : pillIdle)
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div>
            <p className="mb-2 px-3 text-xs text-muted-foreground">Thể loại</p>
            <div className="grid grid-cols-2 gap-1">
              {genres?.slice(0, 12).map((g) => (
                <SheetClose asChild key={g.slug}>
                  <Link
                    to={paths.genre(g.slug)}
                    className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {g.name}
                  </Link>
                </SheetClose>
              ))}
              <Link
                to={paths.genres}
                onClick={close}
                className="col-span-2 rounded-lg px-3 py-2 text-sm text-rose-gold hover:bg-muted"
              >
                Xem tất cả thể loại
              </Link>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
