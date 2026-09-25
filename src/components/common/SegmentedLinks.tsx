import type { ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { cn } from '@/lib/utils'

type Item = { key: string; to: To; label: ReactNode; active: boolean }

type Props = {
  /** Nhãn cho trình đọc màn hình, vd "Tiêu chí xếp hạng" */
  label: string
  items: Item[]
  /** Giữ vị trí cuộn khi chuyển (chỉ đổi query string trong cùng trang) */
  preventScrollReset?: boolean
  /** Thay mục lịch sử thay vì thêm (đổi tab trong cùng trang) */
  replace?: boolean
  className?: string
}

/** Nhóm nút dạng viên thuốc, mỗi nút là một link (trạng thái nằm trên URL) */
export function SegmentedLinks({ label, items, preventScrollReset, replace, className }: Props) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'relative max-w-full [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <ul className="inline-flex rounded-full border p-0.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              replace={replace}
              preventScrollReset={preventScrollReset}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap transition-colors sm:px-3.5',
                item.active
                  ? 'bg-secondary font-medium text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
