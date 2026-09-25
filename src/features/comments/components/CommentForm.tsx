import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { authErrorMessage } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'
import type { User } from '@/types/user'
import { useAddComment } from '../hooks'
import { COMMENT_MAX, commentSchema, type CommentValues } from '../schemas'

type Props = {
  slug: string
  user: User
  /** Có số: bình luận cho chương đó */
  chapter?: number | null
}

export function CommentForm({ slug, user, chapter = null }: Props) {
  const add = useAddComment(slug, chapter)
  const id = chapter === null ? 'comment-content' : `comment-content-${chapter}`
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: '' },
  })
  const length = useWatch({ control, name: 'content' }).length

  const onSubmit = handleSubmit(({ content }) => add.mutate(content, { onSuccess: () => reset() }))

  return (
    <form onSubmit={onSubmit} noValidate className="flex gap-3">
      <UserAvatar user={user} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        {add.isError && <FormAlert>{authErrorMessage(add.error)}</FormAlert>}
        <label htmlFor={id} className="sr-only">
          Viết bình luận
        </label>
        <Textarea
          id={id}
          {...register('content')}
          rows={3}
          placeholder={
            chapter === null
              ? 'Chia sẻ cảm nhận của bạn về truyện này…'
              : 'Bạn nghĩ gì về chương này?'
          }
          aria-invalid={!!errors.content}
          aria-describedby={`${id}-hint`}
          className="min-h-24 resize-y rounded-lg px-3.5 py-3"
        />
        <div className="flex items-center justify-between gap-3">
          <p
            id={`${id}-hint`}
            className={cn(
              'text-xs',
              errors.content || length > COMMENT_MAX ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {errors.content?.message ?? `${length}/${COMMENT_MAX}`}
          </p>
          <Button type="submit" disabled={add.isPending} className="h-9 rounded-full px-5">
            {add.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            {add.isPending ? 'Đang gửi…' : 'Gửi bình luận'}
          </Button>
        </div>
      </div>
    </form>
  )
}
