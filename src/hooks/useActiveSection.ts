import { useEffect, useState } from 'react'

/** Id của section đang nằm trong vùng nhìn (dùng cho thanh mục lục dính) */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join(',')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting)
        const first = key.split(',').find((id) => visible.get(id))
        if (first) setActive(first)
      },
      // Tính một dải ngang ở phần trên màn hình (dưới header + thanh mục lục)
      { rootMargin: '-160px 0px -55% 0px' },
    )
    for (const id of key.split(',')) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [key])

  return active
}
