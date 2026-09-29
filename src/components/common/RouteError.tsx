// Lỗi khi mở trang, thường là không tải được file JS của trang: mất mạng với trang không có trong
// bộ nhớ đệm (khu Sáng tác, Quản trị), hoặc web vừa lên phiên bản mới
import { WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/hooks/useOnline'
import { paths } from '@/lib/routes'

export function RouteError() {
  const online = useOnline()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      {online ? (
        <>
          <p className="font-heading text-3xl font-semibold">Không mở được trang này</p>
          <p className="max-w-sm text-muted-foreground">
            Có thể web vừa được cập nhật. Tải lại trang để thử lại.
          </p>
        </>
      ) : (
        <>
          <WifiOff className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-heading text-3xl font-semibold">Bạn đang offline</p>
          <p className="max-w-sm text-muted-foreground">
            Trang này cần có mạng. Bạn vẫn đọc được các truyện đã lưu trên máy.
          </p>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button className="rounded-full" onClick={() => window.location.reload()}>
          Tải lại trang
        </Button>
        {!online && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to={paths.savedChapters}>Truyện đã lưu</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
