import { useEffect, useRef } from 'react'

/** Thanh tiến độ đọc mỏng trên cùng; cập nhật thẳng style để không render lại khi cuộn */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0
        barRef.current?.style.setProperty('transform', `scaleX(${ratio})`)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        ref={barRef}
        className="h-full origin-left bg-primary shadow-[0_0_10px_var(--primary)]"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  )
}
