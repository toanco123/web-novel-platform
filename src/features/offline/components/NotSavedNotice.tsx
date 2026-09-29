import { WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/routes'

/** Mất mạng mà chương chưa được lưu (trang đọc, cuộn liên tục) */
export function NotSavedNotice({ number, onRetry }: { number: number; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      <p>Chương {number} chưa được lưu để đọc offline.</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Có mạng lại thì bấm "Thử lại", hoặc đọc các truyện đã lưu trên máy.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button className="rounded-full" onClick={onRetry}>
          Thử lại
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to={paths.savedChapters}>Truyện đã lưu</Link>
        </Button>
      </div>
    </div>
  )
}
