import { Button } from '@/components/ui/button'

/**
 * Không tải được dữ liệu (lỗi mạng, máy chủ...): khác với "không tìm thấy", cho bấm thử lại thay vì
 * hiện trang 404.
 */
export function StudioLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-4 py-24 text-center">
      <p>Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.</p>
      <Button className="h-10 rounded-full px-5" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  )
}
