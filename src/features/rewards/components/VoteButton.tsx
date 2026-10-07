import { Minus, Plus, Ticket } from 'lucide-react'
import { type ElementType, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/hooks'
import { StoryCover } from '@/features/stories/StoryCover'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Story } from '@/types/story'
import { rewardErrorMessage } from '../api'
import { useRewardStatus, useStoryVoteSummary, useVoteStory } from '../hooks'
import { RewardBloom } from './RewardBloom'

/**
 * Nút "Đề cử" ở trang truyện (bản thiết kế: plan-diem-danh-va-de-cu.md mục 4). Chỉ có ở truyện đang
 * công khai và không phải của mình; khách bấm thì sang đăng nhập.
 */
export function VoteButton({ story, className }: { story: Story; className?: string }) {
  const { data: user, isPending: sessionPending } = useSession()
  const { data: summary } = useStoryVoteSummary(story.slug)
  const wide = useMediaQuery('(min-width: 40rem)')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const current = useCurrentPath()

  if (story.visibility !== 'published' || (user && story.ownerId === user.id)) return null

  const button = (
    <Button
      variant="outline"
      disabled={sessionPending}
      onClick={() => (user ? setOpen(true) : navigate(paths.login(current)))}
      aria-label={summary ? `Đề cử truyện, ${summary.week} phiếu tuần này` : 'Đề cử truyện'}
      className={cn(
        'h-11 rounded-full border-[#ff3d8b]/60 bg-[#3a1b2e]/60 px-5 text-[#f4e7ed] hover:border-[#ff3d8b] hover:bg-[#3a1b2e] hover:text-[#f4e7ed] dark:bg-[#3a1b2e]/60',
        className,
      )}
    >
      <Ticket className="text-[#ff3d8b]" />
      Đề cử
      {summary && summary.week > 0 && (
        <span className="rounded-full bg-[#ff3d8b]/15 px-2 text-xs font-semibold tabular-nums">
          {formatCount(summary.week)}
        </span>
      )}
    </Button>
  )

  if (!user) return button

  const panel = (Title: ElementType) => (
    <VotePanel story={story} Title={Title} onClose={() => setOpen(false)} />
  )

  return (
    <>
      {button}
      {wide ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent aria-describedby={undefined} className="max-w-md rounded-3xl p-6">
            {panel(DialogTitle)}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            aria-describedby={undefined}
            className="max-h-[92svh] gap-0 overflow-y-auto rounded-t-[1.75rem] border-t px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]"
          >
            <span aria-hidden className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />
            {panel(SheetTitle)}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

const QUICK_AMOUNTS = [1, 5, 10]

function VotePanel({
  story,
  Title,
  onClose,
}: {
  story: Story
  Title: ElementType
  onClose: () => void
}) {
  const { data: status, isPending } = useRewardStatus()
  const { data: summary } = useStoryVoteSummary(story.slug)
  const vote = useVoteStory(story.slug)
  const [amount, setAmount] = useState(1)
  const [done, setDone] = useState<{ amount: number; balance: number } | null>(null)

  const balance = status?.balance ?? 0
  const value = Math.min(Math.max(1, amount), Math.max(1, balance))
  const set = (n: number) => setAmount(Math.min(Math.max(1, n), Math.max(1, balance)))

  const heading = (
    <Title className="pr-8 font-heading text-[1.75rem] leading-tight font-semibold">
      Đề cử truyện
    </Title>
  )

  const storyRow = (
    <div className="flex items-center gap-3.5 rounded-2xl bg-muted p-3">
      <StoryCover story={story} compact className="w-12 shrink-0 rounded-md" />
      <div className="min-w-0 space-y-0.5">
        <p className="line-clamp-1 font-semibold">{story.title}</p>
        <p className="text-sm text-muted-foreground">
          Tuần này{' '}
          <strong className="text-foreground tabular-nums">
            {formatCount(summary?.week ?? 0)}
          </strong>{' '}
          phiếu
        </p>
        {!!summary?.mine && (
          <p className="text-xs text-rose-gold">Bạn đã đề cử {formatCount(summary.mine)} phiếu</p>
        )}
      </div>
    </div>
  )

  if (done) {
    return (
      <div className="space-y-5">
        {heading}
        <div role="status" className="flex flex-col items-center gap-3 py-2 text-center">
          <RewardBloom className="size-16" />
          <p className="font-heading text-[1.75rem] font-semibold">Đã đề cử {done.amount} phiếu</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cảm ơn bạn đã ủng hộ tác giả.
            <br />
            Bạn còn {done.balance} phiếu.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            onClick={() => setDone(null)}
            disabled={done.balance === 0}
            className="h-12 flex-1 rounded-full"
          >
            Đề cử thêm
          </Button>
          <Button asChild className="h-12 flex-1 rounded-full font-semibold">
            <Link to={paths.rankingVotes} onClick={onClose}>
              Xem Đề cử tuần
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="space-y-5" aria-busy aria-label="Đang tải số phiếu">
        {heading}
        {storyRow}
        <Skeleton className="h-16 rounded-full" />
        <Skeleton className="h-12 rounded-full" />
      </div>
    )
  }

  if (balance === 0) {
    return (
      <div className="space-y-5">
        {heading}
        {storyRow}
        <div className="space-y-2 text-center">
          <p className="font-heading text-2xl font-semibold">Bạn chưa có phiếu</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Điểm danh mỗi ngày để nhận phiếu đề cử.
            <br />
            Đủ 7 ngày liền được thêm 3 phiếu.
          </p>
        </div>
        <Button asChild className="h-12 w-full rounded-full font-semibold">
          <Link to={paths.rewards} onClick={onClose}>
            Đi điểm danh
          </Link>
        </Button>
      </div>
    )
  }

  const submit = () =>
    vote.mutate(value, {
      onSuccess: (result) => {
        setDone({ amount: value, balance: result.balance })
        setAmount(1)
        toast.success(`Đã đề cử ${value} phiếu cho ${story.title}`)
      },
      onError: (error) => toast.error(rewardErrorMessage(error)),
    })

  return (
    <div className="space-y-5">
      {heading}
      {storyRow}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span id="vote-amount-label">Chọn số phiếu</span>
        <span className="flex items-center gap-1.5 font-medium text-rose-gold">
          <Ticket className="size-4" aria-hidden />
          Bạn có {balance} phiếu
        </span>
      </div>

      <div
        role="group"
        aria-labelledby="vote-amount-label"
        className="flex items-center justify-between rounded-full border bg-background p-2"
      >
        <Button
          variant="secondary"
          size="icon-lg"
          aria-label="Bớt một phiếu"
          disabled={value <= 1}
          onClick={() => set(value - 1)}
          className="size-12 rounded-full"
        >
          <Minus />
        </Button>
        <span aria-live="polite" className="flex items-baseline gap-2">
          <span className="font-heading text-5xl leading-none font-semibold lining-nums tabular-nums">
            {value}
          </span>
          <span className="text-sm text-muted-foreground">phiếu</span>
        </span>
        <Button
          variant="secondary"
          size="icon-lg"
          aria-label="Thêm một phiếu"
          disabled={value >= balance}
          onClick={() => set(value + 1)}
          className="size-12 rounded-full"
        >
          <Plus />
        </Button>
      </div>

      <div role="group" aria-label="Chọn nhanh" className="grid grid-cols-4 gap-2">
        {[...QUICK_AMOUNTS, balance].map((n, i) => {
          const selected = value === n
          return (
            <Button
              key={i}
              variant="outline"
              aria-pressed={selected}
              disabled={n > balance}
              onClick={() => set(n)}
              className={cn(
                'h-11 rounded-full',
                selected &&
                  'border-neon bg-secondary text-neon hover:text-neon dark:border-neon dark:bg-secondary',
              )}
            >
              {i === QUICK_AMOUNTS.length ? 'Tất cả' : n}
            </Button>
          )
        })}
      </div>

      <Button
        onClick={submit}
        disabled={vote.isPending}
        className="h-12 w-full rounded-full text-base font-semibold"
      >
        {vote.isPending ? 'Đang đề cử…' : `Đề cử ${value} phiếu`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Phiếu đã đề cử không rút lại được.
      </p>
    </div>
  )
}
