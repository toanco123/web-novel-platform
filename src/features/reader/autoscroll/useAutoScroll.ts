import { useEffect, useRef, useState } from 'react'
import { chapterElement } from '../progress'
import { useReaderSettings } from '../useReaderSettings'
import { estimatedPixelsPerWord, pixelsPerSecond, pixelsPerWord, stepSpeed } from './pace'
import { useAutoScrollSettings } from './useAutoScrollSettings'

export type AutoScrollStatus = 'off' | 'running' | 'paused'

export type AutoScroll = {
  status: AutoScrollStatus
  /** Đã tới cuối: hết nội dung chương (từng chương) hoặc đáy trang (cuộn liên tục) */
  atEnd: boolean
  /** Bội số của tốc độ đọc trung bình */
  speed: number
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  faster: () => void
  slower: () => void
}

/** Chừa chỗ cho thanh nổi ở đáy: hết chương khi đoạn cuối đã lên trên mép này */
const BAR_SPACE = 96
/** Khung hình dài nhất được tính, để quay lại tab không bị nhảy xa */
const MAX_FRAME_MS = 100
/** Đo lại số px mỗi chữ sau mỗi khoảng này (đổi cỡ chữ, xoay màn hình, sang chương khác) */
const MEASURE_MS = 1000
/** Vị trí lệch quá mức này so với lần đặt trước thì coi là người đọc tự cuộn */
const USER_SCROLL_PX = 2

/**
 * - 'end': từng chương thì đoạn cuối của chương đã lên trên thanh nổi; cuộn liên tục thì đã
 *   chạm đáy trang và chuỗi chương đã hết (`[data-stream-end]`).
 * - 'wait': cuộn liên tục chạm đáy trang nhưng chương sau chưa kịp nối vào: đứng chờ.
 */
function endState(chapter: number, continuous: boolean): 'end' | 'wait' | null {
  if (continuous) {
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1
    if (!atBottom) return null
    return document.querySelector('[data-stream-end]') ? 'end' : 'wait'
  }
  const paragraphs = chapterElement(chapter)?.querySelectorAll('[data-paragraph]')
  const last = paragraphs?.[paragraphs.length - 1]
  return last && last.getBoundingClientRect().bottom <= window.innerHeight - BAR_SPACE
    ? 'end'
    : null
}

/**
 * Tự động cuộn trang đọc. Đứng yên khi người đọc đang chạm màn hình hoặc đang mở hộp thoại
 * (mục lục, cài đặt...); người đọc tự cuộn thì đi tiếp từ chỗ mới; tới cuối thì tự tạm dừng.
 * `chapter` là chương đang đọc (ở chế độ cuộn liên tục là chương đang ở giữa màn hình).
 */
export function useAutoScroll(chapter: number, continuous: boolean): AutoScroll {
  const { speed, update } = useAutoScrollSettings()
  const [status, setStatus] = useState<AutoScrollStatus>('off')
  const [atEnd, setAtEnd] = useState(false)
  // Giá trị mới nhất cho vòng cuộn đang chạy
  const latest = useRef({ chapter, continuous, speed })
  useEffect(() => {
    latest.current = { chapter, continuous, speed }
  })

  // Đã tới cuối chưa, xét cả lúc dừng: người đọc cuộn ngược lên thì thanh trở lại bình thường
  useEffect(() => {
    if (status === 'off') return
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        setAtEnd(endState(latest.current.chapter, latest.current.continuous) === 'end'),
      )
    }
    check()
    // Trang đổi chiều cao (chương vừa tải xong, chương sau được nối vào) cũng phải xét lại
    const observer = new ResizeObserver(check)
    observer.observe(document.body)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [status, chapter, continuous])

  // Vòng cuộn: giữ vị trí đích dạng số thực để tốc độ chậm vẫn mượt, không cộng dồn sai số làm tròn
  useEffect(() => {
    if (status !== 'running') return
    let frame = 0
    let last: number | null = null
    let target = window.scrollY
    let expected = target
    let measuredAt = -Infinity
    let pxPerWord = 0
    let touching = false
    const onTouchStart = () => {
      touching = true
    }
    const onTouchEnd = () => {
      touching = false
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === null ? 0 : Math.min(now - last, MAX_FRAME_MS)
      last = now
      const { chapter, continuous, speed } = latest.current
      // Người đọc tự cuộn (lăn chuột, phím, kéo thanh cuộn): đi tiếp từ chỗ mới
      if (Math.abs(window.scrollY - expected) > USER_SCROLL_PX) target = window.scrollY
      // Đang chạm tay, hoặc đang mở mục lục / cài đặt / hộp thoại: đứng yên
      if (touching || document.querySelector('[role="dialog"]')) {
        target = expected = window.scrollY
        return
      }
      const end = endState(chapter, continuous)
      if (end === 'end') {
        setAtEnd(true)
        setStatus('paused')
        return
      }
      if (end === 'wait') {
        target = expected = window.scrollY
        return
      }
      if (now - measuredAt >= MEASURE_MS) {
        const { fontSize, lineHeight } = useReaderSettings.getState()
        pxPerWord = pixelsPerWord(
          chapterElement(chapter),
          estimatedPixelsPerWord(fontSize, lineHeight),
        )
        measuredAt = now
      }
      target += (pixelsPerSecond(pxPerWord, speed) * dt) / 1000
      window.scrollTo({ top: target, behavior: 'instant' })
      expected = window.scrollY
    }

    frame = requestAnimationFrame(tick)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [status])

  return {
    status,
    atEnd: status !== 'off' && atEnd,
    speed,
    start: () => {
      setAtEnd(false)
      setStatus('running')
    },
    pause: () => setStatus((s) => (s === 'running' ? 'paused' : s)),
    resume: () => setStatus((s) => (s === 'paused' ? 'running' : s)),
    stop: () => setStatus('off'),
    faster: () => update({ speed: stepSpeed(speed, 1) }),
    slower: () => update({ speed: stepSpeed(speed, -1) }),
  }
}
