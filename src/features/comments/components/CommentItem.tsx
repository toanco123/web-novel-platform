import { Heart } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/features/auth/components/UserAvatar'
import { BlockUserDialog } from '@/features/blocks/components/BlockUserDialog'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { formatCount, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Comment } from '@/types/comment'
import type { User } from '@/types/user'
import { useCommentLike, useDeleteComment, useReplies } from '../hooks'
import { CommentForm } from './CommentForm'
import { DeleteCommentDialog } from './DeleteCommentDialog'
import { ReportCommentDialog } from './ReportCommentDialog'

type Props = {
  /** Bình luận gốc */
  comment: Comment
  /** Người đang xem; null: khách */
  viewer: User | null
  /** Người xem là chủ truyện: xóa được bình luận và trả lời của người khác */
  canModerate?: boolean
}

/** Một bình luận gốc cùng nhóm trả lời của nó (một cấp) */
export function CommentItem({ comment, viewer, canModerate = false }: Props) {
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
        <CommentEntry
          comment={comment}
          viewer={viewer}
          canModerate={canModerate}
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
            <div className="mt-3 border-l pl-4">
              <CommentSkeleton reply />
            </div>
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
                      <CommentEntry
                        comment={reply}
                        viewer={viewer}
                        canModerate={canModerate}
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

/** Khung chờ cùng dáng một bình luận: ảnh đại diện, tên + thời gian, hai dòng chữ, hàng nút */
export function CommentSkeleton({ reply = false }: { reply?: boolean }) {
  return (
    <div className={cn('flex', reply ? 'gap-2.5' : 'gap-3 py-4')} aria-hidden>
      <Skeleton className={cn('shrink-0 rounded-full', reply ? 'size-7' : 'size-9')} />
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center gap-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
        <div className="mt-1.5 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="mt-3 h-3 w-24" />
      </div>
    </div>
  )
}

type EntryProps = {
  comment: Comment
  viewer: User | null
  canModerate: boolean
  onReply: () => void
  /** Khách bấm "Thích", "Báo cáo" hoặc "Chặn" */
  onGuest: () => void
}

/** Phần đầu, nội dung (hoặc ô sửa) và hàng nút của một bình luận hay một trả lời */
function CommentEntry({ comment, viewer, canModerate, onReply, onGuest }: EntryProps) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <CommentHeader comment={comment} />
      {editing && viewer ? (
        <div className="mt-2">
          <CommentForm
            slug={comment.storySlug}
            user={viewer}
            chapter={comment.chapterNumber}
            editing={comment}
            onCancel={() => setEditing(false)}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line text-foreground/90">
            {comment.content}
          </p>
          <CommentActions
            comment={comment}
            viewer={viewer}
            canModerate={canModerate}
            onReply={onReply}
            onEdit={() => setEditing(true)}
            onGuest={onGuest}
          />
        </>
      )}
    </>
  )
}

const fullTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

function CommentHeader({ comment }: { comment: Comment }) {
  return (
    <header className="flex flex-wrap items-baseline gap-x-2">
      <h3 className="text-sm font-medium">{comment.user.displayName}</h3>
      {comment.isAuthor && (
        <span className="self-center rounded-full bg-rose-gold/15 px-1.5 py-px text-[0.625rem] font-semibold tracking-wide text-rose-gold uppercase">
          Tác giả
        </span>
      )}
      <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
        {formatRelativeTime(comment.createdAt)}
      </time>
      {comment.editedAt && (
        <span
          className="text-xs text-muted-foreground"
          title={`Sửa lúc ${fullTime.format(new Date(comment.editedAt))}`}
        >
          · đã sửa
        </span>
      )}
    </header>
  )
}

type ActionsProps = {
  comment: Comment
  viewer: User | null
  canModerate: boolean
  onReply: () => void
  onEdit: () => void
  onGuest: () => void
}

/**
 * Hàng nút dưới một bình luận hoặc trả lời: Thích, Trả lời, rồi Sửa, Xóa (của mình) hoặc Báo cáo,
 * Chặn (của người khác; chủ truyện có thêm Xóa)
 */
function CommentActions({ comment, viewer, canModerate, onReply, onEdit, onGuest }: ActionsProps) {
  const remove = useDeleteComment(comment.storySlug)
  const own = comment.user.id === viewer?.id
  const deleteDialog = (
    <DeleteCommentDialog
      pending={remove.isPending}
      replyCount={comment.replyCount}
      authorName={own ? undefined : comment.user.displayName}
      onConfirm={() => remove.mutate(comment.id)}
    />
  )
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
      <LikeButton comment={comment} viewer={viewer} onGuest={onGuest} />
      <button
        type="button"
        onClick={onReply}
        className="py-1 underline-offset-4 hover:text-foreground hover:underline"
      >
        Trả lời
      </button>
      {own ? (
        <>
          <button
            type="button"
            onClick={onEdit}
            className="py-1 underline-offset-4 hover:text-foreground hover:underline"
          >
            Sửa
          </button>
          {deleteDialog}
        </>
      ) : (
        <>
          {canModerate && deleteDialog}
          <ReportCommentDialog comment={comment} onGuest={viewer ? undefined : onGuest} />
          <BlockUserDialog user={comment.user} onGuest={viewer ? undefined : onGuest} />
        </>
      )}
    </div>
  )
}

/** Tim + số lượt thích. Bình luận của mình chỉ hiện số (không tự thích được) */
function LikeButton({
  comment,
  viewer,
  onGuest,
}: {
  comment: Comment
  viewer: User | null
  onGuest: () => void
}) {
  const like = useCommentLike(comment.storySlug)
  const count = comment.likeCount > 0 ? formatCount(comment.likeCount) : null
  const heart = (
    <Heart
      aria-hidden
      className={cn('size-3.5', comment.likedByMe && 'fill-primary text-primary')}
    />
  )

  if (comment.user.id === viewer?.id) {
    return (
      <span
        className="inline-flex items-center gap-1 py-1"
        title="Không thể tự thích bình luận của mình"
        aria-label={`${comment.likeCount} lượt thích`}
      >
        {heart}
        {count}
      </span>
    )
  }

  const name = comment.user.displayName
  return (
    <button
      type="button"
      aria-pressed={comment.likedByMe}
      aria-label={
        comment.likedByMe ? `Bỏ thích bình luận của ${name}` : `Thích bình luận của ${name}`
      }
      disabled={like.isPending}
      onClick={() => (viewer ? like.mutate({ comment, liked: !comment.likedByMe }) : onGuest())}
      className={cn(
        'inline-flex items-center gap-1 py-1 hover:text-foreground',
        comment.likedByMe && 'text-primary hover:text-primary',
      )}
    >
      {heart}
      {count}
    </button>
  )
}
