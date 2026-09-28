import type { ReactNode } from 'react'

/** Khung thanh điều khiển nổi ở đáy trang đọc (nghe truyện, tự động cuộn) */
export function FloatingBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        role="region"
        aria-label={label}
        className="pointer-events-auto flex w-full max-w-lg items-center gap-1 rounded-full border bg-popover/95 p-1.5 text-popover-foreground shadow-2xl shadow-black/30 backdrop-blur-xl"
      >
        {children}
      </div>
    </div>
  )
}
