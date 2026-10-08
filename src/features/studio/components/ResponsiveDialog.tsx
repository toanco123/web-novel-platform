import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Lớp thêm cho khung trên màn rộng (vd max-w-lg) */
  className?: string
}

/** Hộp thoại trên màn rộng, sheet từ đáy trên điện thoại (như VoteButton) */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: Props) {
  const wide = useMediaQuery('(min-width: 40rem)')
  // Không có mô tả thì báo Radix bỏ aria-describedby (tránh cảnh báo thiếu Description)
  const describedBy = description ? {} : { 'aria-describedby': undefined }
  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent {...describedBy} className={cn('max-w-md', className)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        {...describedBy}
        className="max-h-[92svh] gap-0 overflow-y-auto rounded-t-[1.75rem] border-t px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]"
      >
        <span aria-hidden className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />
        <SheetHeader className="p-0 pb-4">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
