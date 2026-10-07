import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useSession } from '@/features/auth/hooks'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { useRewardStatus } from '../hooks'
import { CheckInCard } from './CheckInCard'

/**
 * Nút điểm danh trên header (chỉ khi đã đăng nhập): chấm `neon` khi hôm nay chưa điểm danh. Từ màn
 * `sm` mở popover, điện thoại mở sheet trượt từ đáy; cả hai chứa CheckInCard.
 */
export function CheckInButton() {
  const { data: user } = useSession()
  const { data: status } = useRewardStatus()
  const wide = useMediaQuery('(min-width: 40rem)')
  const [open, setOpen] = useState(false)
  if (!user) return null

  const pending = status ? !status.checkedInToday : false
  const label = pending ? 'Điểm danh hằng ngày (chưa điểm danh hôm nay)' : 'Điểm danh hằng ngày'
  const trigger = (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      title="Điểm danh"
      className={cn(
        'relative rounded-full',
        pending && 'bg-secondary text-neon ring-1 ring-neon hover:text-neon',
      )}
    >
      <CalendarCheck />
      {pending && (
        <span
          aria-hidden
          className="absolute top-1 right-1 size-2.5 rounded-full bg-neon ring-2 ring-background"
        />
      )}
    </Button>
  )
  const close = () => setOpen(false)

  if (wide) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="w-[26rem] max-w-[calc(100vw-2rem)] gap-0 rounded-3xl border bg-card p-6 shadow-2xl ring-0"
        >
          <CheckInCard onNavigate={close} />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="max-h-[92svh] gap-0 overflow-y-auto rounded-t-[1.75rem] border-t px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]"
      >
        <span aria-hidden className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />
        <CheckInCard titleAs={SheetTitle} onNavigate={close} />
      </SheetContent>
    </Sheet>
  )
}
