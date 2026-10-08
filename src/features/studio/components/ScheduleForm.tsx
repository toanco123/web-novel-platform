import { LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { formatScheduleTime } from '@/lib/format'
import { fromLocalInputs, scheduleProblem, scheduleProblemMessage, toLocalInputs } from '../api'
import { studioErrorMessage } from '../errors'

/** Mặc định: 20:00 ngày mai (giờ của máy) */
function defaultSlot() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 20, 0).toISOString()
}

type Props = {
  /** Giờ hẹn hiện tại của chương; null: chưa hẹn */
  initial: string | null
  submitLabel: string
  pending: boolean
  error?: unknown
  onSubmit: (scheduledAt: string) => void
  /** Có thì hiện nút "Hủy hẹn giờ" (chương đang có giờ hẹn) */
  onUnschedule?: () => void
}

/** Chọn ngày giờ đăng cho một chương (giờ của máy) */
export function ScheduleForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onUnschedule,
}: Props) {
  const id = useId()
  const [value, setValue] = useState(() => toLocalInputs(initial ?? defaultSlot()))
  const [touched, setTouched] = useState(false)
  const scheduledAt = fromLocalInputs(value.date, value.time)
  const problem = scheduledAt ? scheduleProblem(scheduledAt) : 'missing'

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (scheduledAt && !problem) onSubmit(scheduledAt)
      }}
    >
      {error !== undefined && error !== null && <FormAlert>{studioErrorMessage(error)}</FormAlert>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date`}>Ngày đăng</Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={value.date}
            onChange={(e) => setValue((v) => ({ ...v, date: e.target.value }))}
            aria-invalid={touched && !!problem}
            aria-describedby={`${id}-hint`}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-time`}>Giờ đăng</Label>
          <Input
            id={`${id}-time`}
            type="time"
            step={300}
            value={value.time}
            onChange={(e) => setValue((v) => ({ ...v, time: e.target.value }))}
            aria-invalid={touched && !!problem}
            aria-describedby={`${id}-hint`}
            className="h-10"
          />
        </div>
      </div>
      <p
        id={`${id}-hint`}
        className={
          touched && problem ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
        }
      >
        {problem
          ? touched
            ? scheduleProblemMessage[problem]
            : 'Giờ theo múi giờ trên máy của bạn.'
          : `Chương sẽ tự xuất bản lúc ${formatScheduleTime(scheduledAt!)}.`}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {onUnschedule && (
          <Button type="button" variant="ghost" disabled={pending} onClick={onUnschedule}>
            Hủy hẹn giờ
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
