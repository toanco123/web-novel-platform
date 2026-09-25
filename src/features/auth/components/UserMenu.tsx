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
import { paths } from '@/lib/routes'
import type { User } from '@/types/user'
import { useSignOut } from '../hooks'
import { UserAvatar } from './UserAvatar'

export function UserMenu({ user }: { user: User }) {
  const signOut = useSignOut()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tài khoản của ${user.displayName}`}
        className="ml-1 rounded-full ring-rose-gold/50 outline-none hover:ring-2 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar user={user} className="size-9" />
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
