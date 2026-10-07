import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { authErrorMessage } from '@/features/auth/hooks'
import type { User } from '@/types/user'
import { useBlockUser } from '../hooks'

type Props = {
  /** Người viết bình luận */
  user: Pick<User, 'id' | 'displayName'>
  /** Người xem chưa đăng nhập: bấm nút thì gọi hàm này (chuyển sang đăng nhập) thay vì mở hộp thoại */
  onGuest?: () => void
}

/**
 * Nút "Chặn" dưới bình luận của người khác + hộp thoại hỏi lại. Chặn xong mọi bình luận, trả lời của
 * người đó biến mất với mình (RLS); bỏ chặn ở trang Tài khoản.
 */
export function BlockUserDialog({ user, onGuest }: Props) {
  const [open, setOpen] = useState(false)
  const block = useBlockUser()
  const name = user.displayName

  const confirm = () =>
    block.mutate(user.id, {
      onSuccess: () => {
        setOpen(false)
        toast.success(`Đã chặn ${name}`)
      },
    })

  return (
    <>
      <button
        type="button"
        className="py-1 underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => (onGuest ? onGuest() : setOpen(true))}
      >
        Chặn
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) block.reset()
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Chặn {name}?</DialogTitle>
            <DialogDescription>
              Bạn sẽ không thấy bình luận và trả lời của {name} nữa. Người này không được báo. Bỏ
              chặn ở trang Tài khoản.
            </DialogDescription>
          </DialogHeader>
          {block.isError && <FormAlert>{authErrorMessage(block.error)}</FormAlert>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Hủy</Button>
            </DialogClose>
            <Button variant="destructive" disabled={block.isPending} onClick={confirm}>
              Chặn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
