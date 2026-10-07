import { cn } from '@/lib/utils'

/**
 * Bông hoa 5 cánh của logo "Sách nở hoa": biểu tượng quà (ô ngày 7, lời chúc sau khi điểm danh
 * hoặc đề cử). Cánh màu `neon`, nhụy màu `rose-gold` (hoặc `center` khi nằm trên nền `wine`).
 */
export function RewardBloom({
  className,
  center = 'fill-rose-gold',
  label,
}: {
  className?: string
  center?: string
  /** Có thì đọc được bằng trình đọc màn hình; không thì chỉ để trang trí */
  label?: string
}) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={cn('size-7 shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g transform="translate(14 14)" className="fill-neon">
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse key={angle} rx="3.6" ry="6.4" transform={`rotate(${angle}) translate(0 -6)`} />
        ))}
      </g>
      <circle cx="14" cy="14" r="3" className={center} />
    </svg>
  )
}
