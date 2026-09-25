import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type Props = {
  pending: boolean
  onConfirm: () => void
}

export function DeleteCommentDialog({ pending, onConfirm }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
        >
          Xóa
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Xóa bình luận này?</DialogTitle>
          <DialogDescription>
            Bình luận sẽ bị xóa vĩnh viễn và không khôi phục được.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Giữ lại</Button>
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            Xóa bình luận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
