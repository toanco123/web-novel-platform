import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { pageList } from '@/lib/pagination'
import { cn } from '@/lib/utils'

type Props = {
  page: number
  pageCount: number
  /** Query string của từng trang (giữ các tham số khác trên URL để chia sẻ được) */
  searchFor: (page: number) => string
  /** Nhãn cho vùng điều hướng, vd "Phân trang danh sách chương" */
  label: string
  /** Giữ vị trí cuộn khi đổi trang (danh sách nằm giữa trang) */
  preventScrollReset?: boolean
  onNavigate?: () => void
  className?: string
}

/** Phân trang bằng Link (nhãn tiếng Việt); ẩn khi chỉ có 1 trang */
export function Pagination({
  page,
  pageCount,
  searchFor,
  label,
  preventScrollReset,
  onNavigate,
  className,
}: Props) {
  if (pageCount <= 1) return null

  const item =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm tabular-nums'
  const link = (p: number, children: ReactNode, ariaLabel?: string) => (
    <Link
      to={{ search: searchFor(p) }}
      preventScrollReset={preventScrollReset}
      onClick={onNavigate}
      aria-label={ariaLabel}
      aria-current={p === page ? 'page' : undefined}
      className={cn(
        item,
        p === page
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )

  return (
    <nav aria-label={label} className={cn('mt-6', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            link(page - 1, <ChevronLeft className="size-4" />, 'Trang trước')
          ) : (
            <span className={cn(item, 'opacity-40')} aria-hidden>
              <ChevronLeft className="size-4" />
            </span>
          )}
        </li>
        {pageList(page, pageCount).map((p, i) => (
          <li key={`${p}-${i}`}>
            {p === '…' ? (
              <span className={cn(item, 'text-muted-foreground')} aria-hidden>
                …
              </span>
            ) : (
              link(p, p, `Trang ${p}`)
            )}
          </li>
        ))}
        <li>
          {page < pageCount ? (
            link(page + 1, <ChevronRight className="size-4" />, 'Trang sau')
          ) : (
            <span className={cn(item, 'opacity-40')} aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
