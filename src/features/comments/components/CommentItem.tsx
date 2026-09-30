import { useState } from 'react'
import { useNavigate } from 'react-router'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Comment } from '@/types/comment'
import type { User } from '@/types/user'
import { useDeleteComment, useReplies } from '../hooks'
import { CommentForm } from './CommentForm'
import { DeleteCommentDialog } from './DeleteCommentDialog'
import { ReportCommentDialog } from './ReportCommentDialog'

type Props = {
  /** Bình luận gốc */
  comment: Comment
  /** Người đang xem; null: khách */
  viewer: User | null
}

/** Một bình luận gốc cùng nhóm trả lời của nó (một cấp) */
export function CommentItem({ comment, viewer }: Props) {
  const navigate = useNavigate()
  const current = useCurrentPath()
  const [open, setOpen] = useState(false)
  // Ô viết trả lời đang mở với nội dung điền sẵn này ('' hoặc "@Tên "); null: đang đóng
  const [draft, setDraft] = useState<string | null>(null)
  const replies = useReplies(comment.storySlug, comment.id, open)

  const toLogin = () => navigate(paths.login(current))
  const startReply = (mention?: string) =>
    viewer ? setDraft(mention ? `@${mention} ` : '') : toLogin()

  return (
    <article className="flex gap-3 py-4">
      <UserAvatar user={comment.user} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <CommentBody comment={comment} />
        <CommentActions
          comment={comment}
          viewer={viewer}
          onReply={() => startReply()}
          onGuest={toLogin}
        />

        {(comment.replyCount > 0 || open) && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="mt-1 py-1 text-xs font-medium text-rose-gold underline-offset-4 hover:underline"
          >
            {open ? 'Ẩn trả lời' : `Xem ${comment.replyCount} trả lời`}
          </button>
        )}

        {open &&
          (replies.isError ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Không tải được trả lời. Thử lại sau.
            </p>
          ) : replies.isPending ? (
            <div className="mt-3 h-12 animate-pulse rounded-lg bg-muted" />
          ) : (
            replies.data.length > 0 && (
              <ul
                aria-label={`Trả lời bình luận của ${comment.user.displayName}`}
                className="mt-3 space-y-4 border-l pl-4"
              >
                {replies.data.map((reply) => (
                  <li key={reply.id} className="flex gap-2.5">
                    <UserAvatar user={reply.user} className="size-7 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <CommentBody comment={reply} />
                      <CommentActions
                        comment={reply}
                        viewer={viewer}
                        onReply={() => startReply(reply.user.displayName)}
                        onGuest={toLogin}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )
          ))}

        {draft !== null && viewer && (
          <div className={cn('mt-3', open && 'border-l pl-4')}>
            {/* key: bấm "Trả lời" ở câu trả lời khác thì mở form mới với tên người đó */}
            <CommentForm
              key={draft}
              slug={comment.storySlug}
              user={viewer}
              chapter={comment.chapterNumber}
              parentId={comment.id}
              initialContent={draft}
              onCancel={() => setDraft(null)}
              onDone={() => {
                setDraft(null)
                setOpen(true)
              }}
            />
          </div>
        )}
      </div>
    </article>
  )
}

function CommentBody({ comment }: { comment: Comment }) {
  return (
    <>
      <header className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-sm font-medium">{comment.user.displayName}</h3>
        <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
          {formatRelativeTime(comment.createdAt)}
        </time>
      </header>
      <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line text-foreground/90">
        {comment.content}
      </p>
    </>
  )
}

type ActionsProps = {
  comment: Comment
  viewer: User | null
  onReply: () => void
  /** Khách bấm "Báo cáo" */
  onGuest: () => void
}

/** Hàng nút dưới một bình luận hoặc trả lời: Trả lời, rồi Xóa (của mình) hoặc Báo cáo (của người khác) */
function CommentActions({ comment, viewer, onReply, onGuest }: ActionsProps) {
  const remove = useDeleteComment(comment.storySlug)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={onReply}
        className="py-1 underline-offset-4 hover:text-foreground hover:underline"
      >
        Trả lời
      </button>
      {comment.user.id === viewer?.id ? (
        <DeleteCommentDialog
          pending={remove.isPending}
          replyCount={comment.replyCount}
          onConfirm={() => remove.mutate(comment.id)}
        />
      ) : (
        <ReportCommentDialog comment={comment} onGuest={viewer ? undefined : onGuest} />
      )}
    </div>
  )
}
