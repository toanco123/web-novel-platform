import { LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { formatScheduleTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Chapter } from '@/types/chapter'
import { planSchedule, scheduleProblem, scheduleProblemMessage, toLocalInputs } from '../api'
import { studioErrorMessage } from '../errors'
import { useScheduleChapters } from '../hooks'
import { ResponsiveDialog } from './ResponsiveDialog'

/** Thứ Hai đứng đầu như lịch Việt Nam; giá trị là Date.getDay() */
const WEEKDAYS = [
  { day: 1, label: 'T2' },
  { day: 2, label: 'T3' },
  { day: 3, label: 'T4' },
  { day: 4, label: 'T5' },
  { day: 5, label: 'T6' },
  { day: 6, label: 'T7' },
  { day: 0, label: 'CN' },
]
const PER_SLOT = [1, 2, 3]

type Props = {
  storyId: string
  /** Các chương nháp của truyện, theo số chương */
  drafts: Chapter[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Xếp giờ hẹn cho nhiều chương nháp theo nhịp: các thứ trong tuần, một giờ đăng, N chương mỗi lần */
export function ScheduleChaptersDialog({ storyId, drafts, open, onOpenChange }: Props) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Xếp lịch đăng chương"
      description="Các chương nháp đã chọn sẽ tự xuất bản lần lượt theo số chương."
      className="max-w-lg"
    >
      {/* Chỉ dựng form khi mở: mở lại thì chọn lại từ đầu theo danh sách chương nháp mới nhất */}
      {open && (
        <ScheduleChaptersForm
          storyId={storyId}
          drafts={drafts}
          onDone={() => onOpenChange(false)}
        />
      )}
    </ResponsiveDialog>
  )
}

function ScheduleChaptersForm({
  storyId,
  drafts,
  onDone,
}: {
  storyId: string
  drafts: Chapter[]
  onDone: () => void
}) {
  const id = useId()
  const save = useScheduleChapters(storyId)
  const [selected, setSelected] = useState(() => new Set(drafts.map((c) => c.number)))
  const [start, setStart] = useState(() => {
    const d = new Date()
    return toLocalInputs(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString())
      .date
  })
  const [time, setTime] = useState('20:00')
  const [weekdays, setWeekdays] = useState(() => new Set(WEEKDAYS.map((w) => w.day)))
  const [perSlot, setPerSlot] = useState(1)

  const chosen = drafts.filter((c) => selected.has(c.number))
  const plan = planSchedule(
    chosen.map((c) => c.number),
    { start, time, weekdays: [...weekdays], perSlot },
  )
  const problem =
    chosen.length === 0
      ? 'Chọn ít nhất 1 chương.'
      : weekdays.size === 0
        ? 'Chọn ít nhất 1 thứ trong tuần.'
        : !start || !time || plan.length < chosen.length
          ? scheduleProblemMessage.missing
          : plan.some((p) => scheduleProblem(p.scheduledAt))
            ? 'Lịch kéo dài quá 365 ngày. Bớt chương hoặc đăng dày hơn.'
            : null

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  const submit = () =>
    save.mutate(plan, {
      onSuccess: (count) => {
        toast.success(`Đã xếp lịch ${count} chương.`)
        onDone()
      },
    })

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!problem) submit()
      }}
    >
      {save.isError && <FormAlert>{studioErrorMessage(save.error)}</FormAlert>}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Chương</legend>
        <ul
          aria-label="Chọn chương"
          className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2"
        >
          {drafts.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                <Checkbox
                  checked={selected.has(c.number)}
                  onCheckedChange={() => setSelected((s) => toggle(s, c.number))}
                />
                <span className="w-8 shrink-0 text-muted-foreground tabular-nums">{c.number}</span>
                <span className="min-w-0 truncate">{c.title || 'Chưa đặt tên'}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-start`}>Bắt đầu từ ngày</Label>
          <Input
            id={`${id}-start`}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-time`}>Giờ đăng</Label>
          <Input
            id={`${id}-time`}
            type="time"
            step={300}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Các thứ đăng</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => (
            <button
              key={w.day}
              type="button"
              aria-pressed={weekdays.has(w.day)}
              onClick={() => setWeekdays((s) => toggle(s, w.day))}
              className={cn(
                'h-9 min-w-11 rounded-full border px-3 text-sm font-medium transition-colors',
                weekdays.has(w.day)
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Số chương mỗi lần đăng</legend>
        <div role="radiogroup" aria-label="Số chương mỗi lần đăng" className="flex gap-1.5">
          {PER_SLOT.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={perSlot === n}
              onClick={() => setPerSlot(n)}
              className={cn(
                'h-9 min-w-11 rounded-full border px-3 text-sm font-medium tabular-nums transition-colors',
                perSlot === n
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby={`${id}-preview`}>
        <h3 id={`${id}-preview`} className="mb-2 text-sm font-medium">
          Xem trước
        </h3>
        {problem ? (
          <p className="text-sm text-destructive">{problem}</p>
        ) : (
          <ol
            aria-label="Lịch dự kiến"
            className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm"
          >
            {plan.map((p) => {
              const old = drafts.find((c) => c.number === p.number)?.scheduledAt
              return (
                <li key={p.number} className="flex flex-wrap items-baseline gap-x-2 px-2 py-1">
                  <span className="font-medium">Chương {p.number}</span>
                  <span className="text-muted-foreground">{formatScheduleTime(p.scheduledAt)}</span>
                  {old && old !== p.scheduledAt && (
                    <span className="text-xs text-amber-700 dark:text-amber-300">thay giờ cũ</span>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={!!problem || save.isPending}>
          {save.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Lưu lịch ({chosen.length} chương)
        </Button>
      </div>
    </form>
  )
}
