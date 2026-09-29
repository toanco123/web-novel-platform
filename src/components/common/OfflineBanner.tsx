import { WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { useOnline } from '@/hooks/useOnline'
import { paths } from '@/lib/routes'
import { Container } from './Container'

/** Dải dưới header khi mất mạng: các trang cần mạng giữ khung chờ, dải này giải thích lý do */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="border-b bg-secondary text-secondary-foreground">
      <Container className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-2 text-center text-sm">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>Bạn đang offline.</span>
        <Link
          to={paths.savedChapters}
          className="font-medium text-rose-gold underline-offset-4 hover:underline"
        >
          Xem truyện đã lưu
        </Link>
      </Container>
    </div>
  )
}
