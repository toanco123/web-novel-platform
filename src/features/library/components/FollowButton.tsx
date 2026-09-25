import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { useFollowStatus, useToggleFollow } from '../hooks'

type Props = {
  slug: string
  /** Kiểu cho nền tối cố định (banner) */
  onDark?: boolean
  className?: string
}

export function FollowButton({ slug, onDark = false, className }: Props) {
  const { data: user } = useSession()
  const { data: following = false, isPending } = useFollowStatus(slug)
  const toggle = useToggleFollow(slug)
  const navigate = useNavigate()
  const current = useCurrentPath()

  function handleClick() {
    // Chưa đăng nhập: đưa sang đăng nhập rồi quay lại đúng trang này
    if (!user) navigate(paths.login(current))
    else toggle.mutate(!following)
  }

  return (
    <Button
      variant="outline"
      aria-pressed={!!user && following}
      disabled={!!user && isPending}
      onClick={handleClick}
      className={cn(
        'h-11 rounded-full px-5',
        onDark &&
          'border-[#f4e7ed]/30 bg-transparent text-[#f4e7ed] hover:border-[#f4e7ed]/60 hover:bg-white/10 hover:text-[#f4e7ed] dark:bg-transparent',
        following &&
          (onDark ? 'border-[#d9a68f]/60 text-[#d9a68f]' : 'border-rose-gold/60 text-rose-gold'),
        className,
      )}
    >
      {following ? <BookmarkCheck /> : <Bookmark />}
      {following ? 'Đã thêm vào tủ truyện' : 'Thêm vào tủ truyện'}
    </Button>
  )
}
