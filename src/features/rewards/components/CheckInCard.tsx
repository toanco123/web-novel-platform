import { CalendarCheck, Check, Flame, Ticket } from 'lucide-react'
import { type ElementType, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { CHECKIN_CYCLE, type CheckInResult, cycleProgress, rewardErrorMessage } from '../api'
import { useCheckIn, useRewardStatus } from '../hooks'
import { RewardBloom } from './RewardBloom'

const DAYS = Array.from({ length: CHECKIN_CYCLE }, (_, i) => i + 1)

/**
 * Thẻ điểm danh hằng ngày (bản thiết kế: plan-diem-danh-va-de-cu.md mục 4): chuỗi ngày, số phiếu,
 * 7 ô của chu kỳ, nút điểm danh. Dùng trong popover / sheet ở header và trang /rewards.
 */
export function CheckInCard({
  titleAs: Title = 'h2',
  showRewardsLink = true,
  onNavigate,
  className,
}: {
  /** Thẻ tiêu đề (SheetTitle khi nằm trong Sheet để Radix nối aria-labelledby) */
  titleAs?: ElementType
  /** Link "Phiếu của tôi": tắt trên chính trang /rewards */
  showRewardsLink?: boolean
  /** Bấm link trong thẻ (đóng popover / sheet chứa thẻ) */
  onNavigate?: () => void
  className?: string
}) {
  const { data: status, isPending, isError } = useRewardStatus()
  const checkIn = useCheckIn()
  const [result, setResult] = useState<CheckInResult | null>(null)

  const header = (
    <div className="space-y-1">
      <Title className="font-heading text-[1.75rem] leading-tight font-semibold">
        Điểm danh hằng ngày
      </Title>
      <p className="text-sm text-muted-foreground">Đủ 7 ngày liền nhận thêm quà 3 phiếu.</p>
    </div>
  )

  if (isError) {
    return (
      <div className={cn('space-y-4', className)}>
        {header}
        <p role="alert" className="text-sm text-destructive">
          Không tải được thông tin điểm danh. Thử lại sau.
        </p>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className={cn('space-y-5', className)} aria-busy aria-label="Đang tải điểm danh">
        {header}
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton className="h-[5.5rem] rounded-2xl" />
          <Skeleton className="h-[5.5rem] rounded-2xl" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => (
            <Skeleton key={d} className="h-[4.25rem] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-full" />
      </div>
    )
  }

  const { claimed, today } = cycleProgress(status)
  const left = CHECKIN_CYCLE - claimed

  const submit = () =>
    checkIn.mutate(undefined, {
      onSuccess: (r) => {
        setResult(r)
        toast.success(r.reward > 1 ? `+${r.reward} phiếu: thưởng chuỗi 7 ngày!` : '+1 phiếu đề cử')
      },
      onError: (error) => toast.error(rewardErrorMessage(error)),
    })

  return (
    <div className={cn('space-y-5', className)}>
      {header}

      <dl className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-muted p-3.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="size-4 text-neon" aria-hidden />
            Chuỗi liên tiếp
          </dt>
          <dd className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-heading text-4xl leading-none font-semibold lining-nums">
              {status.streak}
            </span>
            <span className="text-sm text-muted-foreground">ngày</span>
          </dd>
        </div>
        <div className="rounded-2xl bg-muted p-3.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Ticket className="size-4 text-rose-gold" aria-hidden />
            Phiếu đề cử
          </dt>
          <dd className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-heading text-4xl leading-none font-semibold text-rose-gold lining-nums">
              {status.balance}
            </span>
            <span className="text-sm text-muted-foreground">phiếu</span>
          </dd>
        </div>
      </dl>

      <ol aria-label="Chu kỳ 7 ngày" className="grid grid-cols-7 gap-1.5">
        {DAYS.map((day) => (
          <DayTile
            key={day}
            day={day}
            claimed={day <= claimed}
            isToday={day === today && !status.checkedInToday}
          />
        ))}
      </ol>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {left === 0 ? 'Đã nhận quà chuỗi 7 ngày' : `Còn ${left} ngày tới quà +3 phiếu`}
          </span>
          <span className="tabular-nums">
            {claimed}/{CHECKIN_CYCLE}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-neon transition-[width] duration-500"
            style={{ width: `${(claimed / CHECKIN_CYCLE) * 100}%` }}
          />
        </div>
      </div>

      {result && (
        <p
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-neon/35 bg-secondary p-3 text-sm"
        >
          <RewardBloom />
          {result.reward > 1
            ? `+${result.reward} phiếu: thưởng chuỗi 7 ngày! Mai bắt đầu chu kỳ mới.`
            : '+1 phiếu đề cử. Hẹn bạn ngày mai nhé!'}
        </p>
      )}

      {status.checkedInToday ? (
        <Button variant="outline" disabled className="h-12 w-full rounded-full text-base">
          <Check aria-hidden />
          Đã điểm danh, quay lại ngày mai
        </Button>
      ) : (
        <Button
          onClick={submit}
          disabled={checkIn.isPending}
          className="h-12 w-full rounded-full text-base font-semibold"
        >
          <CalendarCheck aria-hidden />
          {checkIn.isPending ? 'Đang điểm danh…' : `Điểm danh nhận +${status.nextReward} phiếu`}
        </Button>
      )}

      {showRewardsLink && (
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Dùng phiếu để đề cử truyện bạn thích</span>
          <Link
            to={paths.rewards}
            onClick={onNavigate}
            className="font-medium text-rose-gold hover:underline"
          >
            Phiếu của tôi →
          </Link>
        </p>
      )}
    </div>
  )
}

function DayTile({ day, claimed, isToday }: { day: number; claimed: boolean; isToday: boolean }) {
  const gift = day === CHECKIN_CYCLE
  const label = isToday ? 'Hôm nay' : gift && !claimed ? '+3' : `Ngày ${day}`
  const description = claimed ? 'đã nhận' : isToday ? 'hôm nay, chưa điểm danh' : 'chưa tới'

  return (
    <li
      aria-label={`Ngày ${day}${gift ? ' (quà 3 phiếu)' : ''}: ${description}`}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl px-0.5 pt-2.5 pb-2',
        claimed ? 'bg-secondary' : gift ? 'bg-wine' : 'bg-muted',
        isToday && 'ring-[1.5px] ring-neon outline-4 outline-neon/15 ring-inset',
      )}
    >
      {claimed ? (
        <span className="grid size-7 place-items-center rounded-full bg-rose-gold text-background">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      ) : isToday ? (
        <span className="grid size-7 place-items-center rounded-full border-[1.5px] border-dashed border-neon text-[0.7rem] font-bold text-neon">
          {gift ? '+3' : '+1'}
        </span>
      ) : gift ? (
        <RewardBloom center="fill-white" />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-background text-[0.7rem] font-semibold text-muted-foreground">
          +1
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          'text-[0.65rem] whitespace-nowrap',
          isToday
            ? 'font-semibold text-neon'
            : gift && !claimed
              ? 'font-bold text-white'
              : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </li>
  )
}
