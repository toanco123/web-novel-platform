import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { formatRelativeTime } from '@/lib/format'
import type { Comment } from '@/types/comment'
import { useDeleteComment } from '../hooks'
import { DeleteCommentDialog } from './DeleteCommentDialog'

export function CommentItem({ comment, isOwn }: { comment: Comment; isOwn: boolean }) {
  const remove = useDeleteComment(comment.storySlug)

  return (
    <article className="flex gap-3 py-4">
      <UserAvatar user={comment.user} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-medium">{comment.user.displayName}</h3>
          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </time>
          {isOwn && (
            <span className="ml-auto">
              <DeleteCommentDialog
                pending={remove.isPending}
                onConfirm={() => remove.mutate(comment.id)}
              />
            </span>
          )}
        </header>
        <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line text-foreground/90">
          {comment.content}
        </p>
      </div>
    </article>
  )
}
