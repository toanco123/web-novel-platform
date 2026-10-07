// Lỗi khi mở trang, thường là không tải được file JS của trang: mất mạng với trang không có trong
// bộ nhớ đệm (khu Sáng tác, Quản trị), hoặc web vừa lên phiên bản mới
import { WifiOff } from 'lucide-react'
import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/hooks/useOnline'
import { reloadApp } from '@/lib/appUpdate'
import { reportError } from '@/lib/monitoring'
import { paths } from '@/lib/routes'

export function RouteError() {
  const online = useOnline()
  const error = useRouteError()
  // Lỗi tải file JS và mất mạng bị lọc trong reportError; còn lại là lỗi code của trang
  useEffect(() => {
    if (!isRouteErrorResponse(error)) reportError(error, { source: 'route' })
  }, [error])
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
        <Button className="rounded-full" onClick={reloadApp}>
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
