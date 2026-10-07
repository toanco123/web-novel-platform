// Đăng ký service worker; có bản mới thì hỏi trước khi tải lại (tự tải lại khi đang đọc sẽ mất chỗ
// đang đọc). Không bấm thì lần mở app sau dùng bản mới. Gắn ở main.tsx (test không chạy file này).
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { setPendingUpdate } from '@/lib/appUpdate'

/** Đăng ký service worker sau khi trang tải xong và máy rảnh thêm chừng này */
const REGISTER_DELAY_MS = 3000

/**
 * Service worker tải sẵn file cho đọc offline (khoảng 2 MB). Đăng ký trễ để không tranh băng thông
 * với lần mở trang đầu tiên trên mạng chậm.
 */
export function DeferredPwaUpdater() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const start = () => {
      const later = () => (timer = setTimeout(() => setReady(true), REGISTER_DELAY_MS))
      if ('requestIdleCallback' in window) requestIdleCallback(later)
      else later()
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('load', start)
    }
  }, [])
  return ready ? <PwaUpdater /> : null
}

function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    // Màn hình lỗi (RouteError) "Tải lại trang" cũng kích hoạt bản mới
    setPendingUpdate(() => void updateServiceWorker(true))
    toast('Có phiên bản mới', {
      description: 'Cập nhật để dùng bản mới nhất của web.',
      duration: Infinity,
      action: { label: 'Cập nhật', onClick: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
