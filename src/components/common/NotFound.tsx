import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { paths } from '@/lib/routes'
import { Seo } from './Seo'

export function NotFound({ message = 'Trang bạn tìm không tồn tại.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
      <Seo title={`Không tìm thấy trang | ${SITE_NAME}`} noindex />
      <p className="font-heading text-7xl font-semibold text-muted-foreground lining-nums">404</p>
      <p>{message}</p>
      <Button asChild className="h-10 rounded-full px-5">
        <Link to={paths.home}>Về trang chủ</Link>
      </Button>
    </div>
  )
}
