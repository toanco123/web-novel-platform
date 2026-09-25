import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { User } from '@/types/user'
import { initials } from '../initials'

export function UserAvatar({
  user,
  className,
}: {
  user: Pick<User, 'displayName' | 'avatarUrl'>
  className?: string
}) {
  return (
    <Avatar className={className}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="bg-wine font-medium text-[#f4e7ed]">
        {initials(user.displayName)}
      </AvatarFallback>
    </Avatar>
  )
}
