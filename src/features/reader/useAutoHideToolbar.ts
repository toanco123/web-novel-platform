import { useEffect, useState } from 'react'

const TOP_ZONE = 64
const MIN_DELTA = 8

/** Ẩn thanh công cụ khi cuộn xuống đọc, hiện lại khi cuộn lên, ở đầu hoặc cuối trang */
export function useAutoHideToolbar() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - TOP_ZONE
        if (y < TOP_ZONE || atBottom) {
          setVisible(true)
        } else if (Math.abs(y - last) >= MIN_DELTA) {
          setVisible(y < last)
        } else return
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return [visible, setVisible] as const
}
