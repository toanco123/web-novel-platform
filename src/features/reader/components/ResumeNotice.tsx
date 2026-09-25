import { History, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { chapterElement, scrollToProgress } from '../progress'

const VISIBLE_MS = 6000

/** Báo vừa mở lại chỗ đọc dở, kèm nút quay về đầu chương; tự ẩn sau vài giây */
export function ResumeNotice({ chapter }: { chapter: number }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!open) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-2 rounded-full border bg-popover/95 py-1.5 pr-1.5 pl-4 text-sm text-popover-foreground shadow-lg backdrop-blur"
      >
        <History className="size-4 shrink-0 text-rose-gold" aria-hidden />
        <span>Đã mở lại chỗ bạn đọc dở</span>
        <button
          type="button"
          onClick={() => {
            const el = chapterElement(chapter)
            if (el) scrollToProgress(el, 0)
            setOpen(false)
          }}
          className="rounded-full px-2.5 py-1 font-medium text-rose-gold hover:bg-muted"
        >
          Về đầu chương
        </button>
        <button
          type="button"
          aria-label="Đóng thông báo"
          onClick={() => setOpen(false)}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
