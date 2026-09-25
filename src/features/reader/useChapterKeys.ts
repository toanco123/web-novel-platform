import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '@/lib/routes'

const IGNORE = 'input, textarea, select, [contenteditable="true"], [role="slider"]'

/** Phím ← → để chuyển chương (bỏ qua khi đang gõ hoặc đang mở hộp thoại) */
export function useChapterKeys(slug: string, prev?: number, next?: number) {
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if ((e.target as Element | null)?.closest?.(IGNORE)) return
      if (document.querySelector('[role="dialog"]')) return
      const target = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : undefined
      if (target === undefined) return
      e.preventDefault()
      navigate(paths.chapter(slug, target))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, slug, prev, next])
}
