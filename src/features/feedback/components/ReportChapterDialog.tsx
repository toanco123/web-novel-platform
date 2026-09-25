import { zodResolver } from '@hookform/resolvers/zod'
import { Flag, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
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
import { authErrorMessage, useSession } from '@/features/auth/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { useReportChapter } from '../hooks'
import { REPORT_NOTE_MAX, reportReasons, reportSchema, type ReportValues } from '../schemas'

type Props = { slug: string; chapter: number; className?: string }

/** Nút "Báo lỗi chương" + hộp thoại chọn lý do; chưa đăng nhập thì chuyển sang đăng nhập */
export function ReportChapterDialog({ slug, chapter, className }: Props) {
  const { data: user } = useSession()
  const navigate = useNavigate()
  const current = useCurrentPath()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn('rounded-full text-muted-foreground', className)}
        onClick={() => (user ? setOpen(true) : navigate(paths.login(current)))}
      >
        <Flag />
        Báo lỗi chương
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {/* key: mở lại là form mới */}
          {open && <ReportForm key={chapter} slug={slug} chapter={chapter} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReportForm({ slug, chapter }: { slug: string; chapter: number }) {
  const report = useReportChapter()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportValues>({
    resolver: zodResolver(reportSchema),
    mode: 'onTouched',
    defaultValues: { reason: 'typo', note: '' },
  })
  const noteLength = useWatch({ control, name: 'note' }).length

  if (report.isSuccess) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Đã gửi báo lỗi</DialogTitle>
          <DialogDescription>
            Cảm ơn bạn! Tác giả sẽ thấy báo lỗi này trong khu Sáng tác và sửa sớm nhất có thể.
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

  const onSubmit = handleSubmit((values) => report.mutate({ slug, chapter, ...values }))

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Báo lỗi chương {chapter}</DialogTitle>
        <DialogDescription>Chọn lỗi bạn gặp. Tác giả sẽ nhận được báo lỗi này.</DialogDescription>
      </DialogHeader>
      <div className="mt-5 space-y-5">
        {report.isError && <FormAlert>{authErrorMessage(report.error)}</FormAlert>}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Loại lỗi</legend>
          <div className="space-y-1.5">
            {reportReasons.map((r) => (
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
          <label htmlFor="report-note" className="text-sm font-medium">
            Ghi chú{' '}
            <span className="font-normal text-muted-foreground">(đoạn nào, sai ra sao)</span>
          </label>
          <Textarea
            id="report-note"
            {...register('note')}
            rows={3}
            aria-invalid={!!errors.note}
            aria-describedby="report-note-hint"
            className="min-h-20 resize-y rounded-lg px-3.5 py-3"
          />
          <p
            id="report-note-hint"
            className={cn(
              'text-xs',
              errors.note || noteLength > REPORT_NOTE_MAX
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {errors.note?.message ?? `${noteLength}/${REPORT_NOTE_MAX}`}
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
          {report.isPending ? 'Đang gửi…' : 'Gửi báo lỗi'}
        </Button>
      </DialogFooter>
    </form>
  )
}
