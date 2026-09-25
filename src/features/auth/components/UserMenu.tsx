import { BookMarked, LogOut, PenLine, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLibraryUpdateCount } from '@/features/library/hooks'
import { paths } from '@/lib/routes'
import type { User } from '@/types/user'
import { useSignOut } from '../hooks'
import { UserAvatar } from './UserAvatar'

/** Số truyện đang theo dõi có chương mới */
export function UpdateBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto rounded-full bg-neon px-1.5 text-[0.7rem] leading-4 font-semibold text-background">
      {count}
      <span className="sr-only"> truyện có chương mới</span>
    </span>
  )
}

export function UserMenu({ user }: { user: User }) {
  const signOut = useSignOut()
  const navigate = useNavigate()
  const { data: updates = 0 } = useLibraryUpdateCount()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          updates > 0
            ? `Tài khoản của ${user.displayName}, ${updates} truyện có chương mới`
            : `Tài khoản của ${user.displayName}`
        }
        className="relative ml-1 rounded-full ring-rose-gold/50 outline-none hover:ring-2 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar user={user} className="size-9" />
        {updates > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-neon ring-2 ring-background"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={paths.library}>
            <BookMarked />
            Tủ truyện
            <UpdateBadge count={updates} />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={paths.studio}>
            <PenLine />
            Sáng tác
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={paths.account}>
            <UserRound />
            Tài khoản
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signOut.isPending}
          onSelect={() => signOut.mutate(undefined, { onSuccess: () => navigate(paths.home) })}
        >
          <LogOut />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
