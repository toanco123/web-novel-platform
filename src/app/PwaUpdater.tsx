// Đăng ký service worker; có bản mới thì hỏi trước khi tải lại (tự tải lại khi đang đọc sẽ mất chỗ
// đang đọc). Không bấm thì lần mở app sau dùng bản mới. Gắn ở main.tsx (test không chạy file này).
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { setPendingUpdate } from '@/lib/appUpdate'

export function PwaUpdater() {
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
