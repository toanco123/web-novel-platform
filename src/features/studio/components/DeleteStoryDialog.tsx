import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { paths } from '@/lib/routes'
import { studioErrorMessage } from '../errors'
import { useDeleteStory } from '../hooks'
import { ConfirmDialog } from './ConfirmDialog'

/** Xóa truyện: phải gõ đúng tên truyện để tránh bấm nhầm */
export function DeleteStoryDialog({ storyId, title }: { storyId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const remove = useDeleteStory(storyId)
  const navigate = useNavigate()

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setTyped('')
          setOpen(true)
        }}
      >
        Xóa truyện
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xóa truyện này?"
        description="Truyện và toàn bộ chương sẽ bị xóa vĩnh viễn, không khôi phục được."
        confirmLabel="Xóa vĩnh viễn"
        destructive
        pending={remove.isPending}
        confirmDisabled={typed.trim() !== title}
        onConfirm={() =>
          remove.mutate(undefined, { onSuccess: () => navigate(paths.studio, { replace: true }) })
        }
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
    </>
  )
}
