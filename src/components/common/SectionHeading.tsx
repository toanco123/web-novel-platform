import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

type Props = {
  id: string
  icon?: ReactNode
  moreTo?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function SectionHeading({ id, icon, moreTo, actions, className, children }: Props) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <h2 id={id} className="flex items-center gap-2 font-heading text-3xl font-semibold">
        {icon}
        {children}
      </h2>
      <div className="flex items-center gap-2">
        {moreTo && (
          <Link
            to={moreTo}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Xem tất cả
          </Link>
        )}
        {actions}
      </div>
    </div>
  )
}

export function SectionError() {
  return (
    <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      Không tải được danh sách này. Tải lại trang để thử lại.
    </p>
  )
}
