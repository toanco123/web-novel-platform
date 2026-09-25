import { Star } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { Score } from '@/types/comment'

type Props = {
  value: Score | null
  onChange: (score: Score) => void
  disabled?: boolean
}

const scores: Score[] = [1, 2, 3, 4, 5]

/** 5 ngôi sao dạng radio group: bấm, hoặc Tab vào rồi dùng phím mũi tên */
export function StarRatingInput({ value, onChange, disabled }: Props) {
  const [hover, setHover] = useState<Score | null>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const shown = hover ?? value ?? 0
  const focusable = value ?? 1

  function handleKey(e: KeyboardEvent, score: Score) {
    const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (!delta) return
    e.preventDefault()
    const next = Math.min(5, Math.max(1, score + delta)) as Score
    refs.current[next - 1]?.focus()
    onChange(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Đánh giá của bạn"
      className="flex gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {scores.map((s) => (
        <button
          key={s}
          ref={(el) => {
            refs.current[s - 1] = el
          }}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} sao`}
          tabIndex={s === focusable ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onKeyDown={(e) => handleKey(e, s)}
          className="rounded-md p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <Star
            className={cn(
              'size-7 transition-colors',
              s <= shown ? 'fill-rose-gold text-rose-gold' : 'text-muted-foreground/60',
            )}
          />
        </button>
      ))}
    </div>
  )
}
