import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { authErrorMessage } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'
import type { Comment } from '@/types/comment'
import type { User } from '@/types/user'
import { useAddComment, useEditComment } from '../hooks'
import { COMMENT_MAX, commentSchema, type CommentValues } from '../schemas'

type Props = {
  slug: string
  user: User
  /** Có số: bình luận cho chương đó */
  chapter?: number | null
  /** Có giá trị: ô viết trả lời cho bình luận gốc này */
  parentId?: string | null
  /** Nội dung điền sẵn (trả lời một câu trả lời: "@Tên ") */
  initialContent?: string
  /** Có giá trị: sửa bình luận này tại chỗ (không có ảnh đại diện, nút "Lưu") */
  editing?: Comment
  /** Gửi xong */
  onDone?: () => void
  /** Có thì hiện nút "Hủy" */
  onCancel?: () => void
}

export function CommentForm({
  slug,
  user,
  chapter = null,
  parentId = null,
  initialContent = '',
  editing,
  onDone,
  onCancel,
}: Props) {
  const add = useAddComment(slug, chapter, parentId)
  const edit = useEditComment(slug)
  const mutation = editing ? edit : add
  const isReply = parentId !== null
  const id = editing
    ? `edit-content-${editing.id}`
    : isReply
      ? `reply-content-${parentId}`
      : chapter === null
        ? 'comment-content'
        : `comment-content-${chapter}`
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: editing?.content ?? initialContent },
  })
  const content = useWatch({ control, name: 'content' })
  const length = content.length
  // Sửa mà nội dung chưa đổi thì không có gì để lưu
  const unchanged = !!editing && content.trim() === editing.content
  const field = register('content')
  const textarea = useRef<HTMLTextAreaElement | null>(null)

  // Ô trả lời / ô sửa vừa mở: đưa con trỏ vào cuối nội dung điền sẵn để viết tiếp ngay
  const focusOnOpen = isReply || !!editing
  useEffect(() => {
    const el = textarea.current
    if (!focusOnOpen || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [focusOnOpen])

  const onSubmit = handleSubmit(({ content }) => {
    if (editing) {
      edit.mutate({ id: editing.id, content }, { onSuccess: () => onDone?.() })
      return
    }
    add.mutate(content, {
      onSuccess: () => {
        reset({ content: '' })
        onDone?.()
      },
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex gap-3">
      {!editing && (
        <UserAvatar user={user} className={cn('shrink-0', isReply ? 'size-7' : 'size-9')} />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        {mutation.isError && <FormAlert>{authErrorMessage(mutation.error)}</FormAlert>}
        <label htmlFor={id} className="sr-only">
          {editing ? 'Sửa bình luận' : isReply ? 'Viết trả lời' : 'Viết bình luận'}
        </label>
        <Textarea
          id={id}
          {...field}
          ref={(el) => {
            field.ref(el)
            textarea.current = el
          }}
          rows={isReply || editing ? 2 : 3}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && onCancel && !mutation.isPending) onCancel()
          }}
          placeholder={
            isReply
              ? 'Viết trả lời…'
              : chapter === null
                ? 'Chia sẻ cảm nhận của bạn về truyện này…'
                : 'Bạn nghĩ gì về chương này?'
          }
          aria-invalid={!!errors.content}
          aria-describedby={`${id}-hint`}
          className={cn(
            'resize-y rounded-lg px-3.5 py-3',
            isReply || editing ? 'min-h-16' : 'min-h-24',
          )}
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
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={mutation.isPending}
                className="h-9 rounded-full px-4"
              >
                Hủy
              </Button>
            )}
            <Button
              type="submit"
              disabled={mutation.isPending || unchanged}
              className="h-9 rounded-full px-5"
            >
              {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              {editing
                ? mutation.isPending
                  ? 'Đang lưu…'
                  : 'Lưu'
                : mutation.isPending
                  ? 'Đang gửi…'
                  : isReply
                    ? 'Gửi trả lời'
                    : 'Gửi bình luận'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
