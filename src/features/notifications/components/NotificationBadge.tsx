import { useEffect } from 'react'
import { useUnreadNotificationCount } from '../hooks'
import { setFaviconDot, stripCount, withCount } from '../tabBadge'

/**
 * Gắn một lần ở gốc app: số thông báo chưa đọc hiện trên tab, dạng "(2) Tên trang" và chấm đỏ trên
 * favicon. Trang đổi `<title>` (React 19 ghi lại) thì tiền tố được gắn lại.
 */
export function NotificationBadge() {
  const { data: count = 0 } = useUnreadNotificationCount()
  const unread = count > 0

  useEffect(() => {
    const apply = () => {
      const next = withCount(document.title, count)
      if (document.title !== next) document.title = next
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      document.title = stripCount(document.title)
    }
  }, [count])

  useEffect(() => {
    void setFaviconDot(unread)
  }, [unread])

  return null
}
