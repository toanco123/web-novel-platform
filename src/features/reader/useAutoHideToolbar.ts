import { useEffect, useRef, useState } from 'react'

const TOP_ZONE = 64
const MIN_DELTA = 8

/**
 * Ẩn thanh công cụ khi cuộn xuống đọc, hiện lại khi cuộn lên, ở đầu hoặc cuối trang.
 * `frozen` (đang tự động cuộn): không ẩn/hiện theo cuộn nữa, chỉ đổi khi người đọc chạm vào chữ,
 * nếu không thanh vừa hiện ra đã bị cuộn ẩn đi ngay.
 */
export function useAutoHideToolbar(frozen = false) {
  const [visible, setVisible] = useState(true)
  const frozenRef = useRef(frozen)
  useEffect(() => {
    frozenRef.current = frozen
  })

  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        if (frozenRef.current) {
          last = y
          return
        }
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
