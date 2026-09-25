import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { studioErrorMessage } from '../errors'
import { useDeleteStory } from '../hooks'
import { ConfirmDialog } from './ConfirmDialog'

type Props = {
  storyId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Gọi sau khi xóa xong (điều hướng hoặc đóng dialog) */
  onDeleted: () => void
}

/** Xóa truyện: phải gõ đúng tên truyện để tránh bấm nhầm */
export function DeleteStoryDialog({ storyId, title, open, onOpenChange, onDeleted }: Props) {
  const [typed, setTyped] = useState('')
  const remove = useDeleteStory(storyId)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        // Mở lại thì bắt đầu từ ô trống, không còn lỗi cũ
        if (!next) {
          setTyped('')
          remove.reset()
        }
        onOpenChange(next)
      }}
      title="Xóa truyện này?"
      description="Truyện và toàn bộ chương sẽ bị xóa vĩnh viễn, không khôi phục được."
      confirmLabel="Xóa vĩnh viễn"
      destructive
      pending={remove.isPending}
      confirmDisabled={typed.trim() !== title}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onDeleted })}
    >
      <div className="space-y-2">
        {remove.isError && <FormAlert>{studioErrorMessage(remove.error)}</FormAlert>}
        <label htmlFor="confirm-title" className="text-sm">
          Gõ <strong className="font-semibold">{title}</strong> để xác nhận
        </label>
        <Input
          id="confirm-title"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="h-10"
        />
      </div>
    </ConfirmDialog>
  )
}
