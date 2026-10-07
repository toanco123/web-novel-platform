import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router'

/** Chờ bao lâu mới hiện thanh: chuyển trang nhanh thì không nháy */
const SHOW_AFTER_MS = 150

/**
 * Thanh mảnh ở đỉnh màn hình khi đang chuyển trang (tải code của trang mới). Mạng chậm thì người
 * dùng biết là đã bấm, không tưởng link không ăn.
 */
export function NavigationProgress() {
  const loading = useNavigation().state !== 'idle'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS)
    return () => {
      clearTimeout(timer)
      setVisible(false)
    }
  }, [loading])

  if (!visible) return null
  return (
    <div
      role="progressbar"
      aria-label="Đang chuyển trang"
      className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/20"
    >
      <div className="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-primary motion-reduce:w-full motion-reduce:animate-none" />
    </div>
  )
}
