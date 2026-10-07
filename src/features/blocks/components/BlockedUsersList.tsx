import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { authErrorMessage } from '@/features/auth/hooks'
import { formatRelativeTime } from '@/lib/format'
import type { BlockedUser } from '../api'
import { useBlockedUsers, useUnblockUser } from '../hooks'

/** Danh sách người đã chặn ở trang Tài khoản: bỏ chặn thì thấy lại bình luận của người đó */
export function BlockedUsersList() {
  const { data, isPending, isError } = useBlockedUsers()

  if (isError) {
    return <p className="text-sm text-muted-foreground">Không tải được danh sách. Thử lại sau.</p>
  }
  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Bạn chưa chặn ai. Muốn chặn một người, bấm "Chặn" dưới bình luận của họ.
      </p>
    )
  }
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Bạn không thấy bình luận và trả lời của những người này. Họ không được báo khi bị chặn.
      </p>
      <ul aria-label="Người đã chặn" className="mt-3 divide-y">
        {data.map((item) => (
          <BlockedRow key={item.user.id} item={item} />
        ))}
      </ul>
    </>
  )
}

function BlockedRow({ item }: { item: BlockedUser }) {
  const unblock = useUnblockUser()
  const name = item.user.displayName
  return (
    <li className="flex items-center gap-3 py-3">
      <UserAvatar user={item.user} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          Đã chặn {formatRelativeTime(item.blockedAt)}
        </p>
      </div>
      <Button
        variant="outline"
        className="h-9 rounded-full px-4"
        aria-label={`Bỏ chặn ${name}`}
        disabled={unblock.isPending}
        onClick={() =>
          unblock.mutate(item.user.id, {
            onSuccess: () => toast.success(`Đã bỏ chặn ${name}`),
            onError: (error) => toast.error(authErrorMessage(error)),
          })
        }
      >
        Bỏ chặn
      </Button>
    </li>
  )
}
