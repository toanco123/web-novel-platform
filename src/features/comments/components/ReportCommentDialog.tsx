import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { authErrorMessage } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'
import type { Comment } from '@/types/comment'
import { useReportComment } from '../hooks'
import {
  COMMENT_REPORT_NOTE_MAX,
  commentReportReasons,
  commentReportSchema,
  type CommentReportValues,
} from '../schemas'

type Props = {
  comment: Comment
  /** Người xem chưa đăng nhập: bấm nút thì gọi hàm này (chuyển sang đăng nhập) thay vì mở hộp thoại */
  onGuest?: () => void
}

/** Nút "Báo cáo" + hộp thoại chọn lý do báo cáo một bình luận cho ban quản trị */
export function ReportCommentDialog({ comment, onGuest }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="py-1 underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => (onGuest ? onGuest() : setOpen(true))}
      >
        Báo cáo
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {/* Chỉ dựng form khi mở: mở lại là form mới */}
          {open && <ReportForm comment={comment} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReportForm({ comment }: { comment: Comment }) {
  const report = useReportComment()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CommentReportValues>({
    resolver: zodResolver(commentReportSchema),
    mode: 'onTouched',
    defaultValues: { reason: 'spam', note: '' },
  })
  const noteLength = useWatch({ control, name: 'note' }).length

  if (report.isSuccess) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Đã gửi báo cáo</DialogTitle>
          <DialogDescription>
            Cảm ơn bạn! Ban quản trị sẽ xem bình luận này và gỡ nếu vi phạm.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Đóng</Button>
          </DialogClose>
        </DialogFooter>
      </>
    )
  }

  const onSubmit = handleSubmit((values) => report.mutate({ commentId: comment.id, ...values }))

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Báo cáo bình luận</DialogTitle>
        <DialogDescription>
          Bình luận của {comment.user.displayName}. Chỉ ban quản trị thấy báo cáo này.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-5">
        {report.isError && <FormAlert>{authErrorMessage(report.error)}</FormAlert>}
        <blockquote className="line-clamp-3 border-l-2 pl-3 text-sm break-words whitespace-pre-line text-muted-foreground">
          {comment.content}
        </blockquote>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Lý do</legend>
          <div className="space-y-1.5">
            {commentReportReasons.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/40"
              >
                <input
                  type="radio"
                  value={r.value}
                  {...register('reason')}
                  className="size-4 accent-primary"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <label htmlFor="comment-report-note" className="text-sm font-medium">
            Ghi chú <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
          </label>
          <Textarea
            id="comment-report-note"
            {...register('note')}
            rows={3}
            aria-invalid={!!errors.note}
            aria-describedby="comment-report-note-hint"
            className="min-h-20 resize-y rounded-lg px-3.5 py-3"
          />
          <p
            id="comment-report-note-hint"
            className={cn(
              'text-xs',
              errors.note || noteLength > COMMENT_REPORT_NOTE_MAX
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {errors.note?.message ?? `${noteLength}/${COMMENT_REPORT_NOTE_MAX}`}
          </p>
        </div>
      </div>
      <DialogFooter className="mt-6">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Hủy
          </Button>
        </DialogClose>
        <Button type="submit" disabled={report.isPending}>
          {report.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {report.isPending ? 'Đang gửi…' : 'Gửi báo cáo'}
        </Button>
      </DialogFooter>
    </form>
  )
}
