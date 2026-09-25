import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'

/** Hỏi lại khi rời trang (trong app hoặc đóng tab) mà còn thay đổi chưa lưu */
export function useUnsavedChangesPrompt(when: boolean) {
  const allowRef = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && !allowRef.current && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])

  return {
    blocker,
    /** Gọi trước khi tự điều hướng sau khi lưu thành công */
    allowNextNavigation: () => {
      allowRef.current = true
    },
  }
}
