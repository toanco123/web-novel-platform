import { useCallback, useEffect, useRef, useState } from 'react'
import { readMock, writeMock } from '@/lib/mockStorage'

type Draft = { title: string; content: string; savedAt: string }
const AUTOSAVE_MS = 5000

/**
 * Tự lưu bản đang viết vào trình duyệt 5 giây sau lần gõ cuối (chỉ khi có thay đổi),
 * để lỡ đóng tab / mất mạng vẫn khôi phục được. Đây là tiện ích phía trình duyệt, không phải dữ liệu truyện.
 */
export function useEditorAutosave(
  key: string,
  values: { title: string; content: string },
  enabled: boolean,
  loaded: { title: string; content: string },
) {
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  // Bản viết dở từ lần trước, chỉ đề nghị khôi phục nếu khác với nội dung đang có
  const [restorable, setRestorable] = useState<Draft | null>(() => {
    const draft = readMock<Draft | null>(key, null)
    return draft && (draft.title !== loaded.title || draft.content !== loaded.content)
      ? draft
      : null
  })
  const latest = useRef(values)
  useEffect(() => {
    latest.current = values
  })

  const flush = useCallback(() => {
    const time = new Date()
    writeMock(key, { ...latest.current, savedAt: time.toISOString() })
    setSavedAt(time)
  }, [key])

  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(flush, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [enabled, values.title, values.content, flush])

  return {
    savedAt,
    restorable,
    dismiss: () => {
      setRestorable(null)
      writeMock(key, null)
    },
    /** Lưu ngay (vd trước khi rời trang) */
    flush: () => enabled && flush(),
    /** Xóa bản nháp trình duyệt sau khi đã lưu thật */
    clear: () => writeMock(key, null),
  }
}
