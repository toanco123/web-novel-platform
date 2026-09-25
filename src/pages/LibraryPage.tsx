import { Link, useSearchParams } from 'react-router'
import { Container } from '@/components/common/Container'
import { PageLoader } from '@/components/common/PageLoader'
import { SegmentedLinks } from '@/components/common/SegmentedLinks'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { useSession } from '@/features/auth/hooks'
import { FollowingList } from '@/features/library/components/FollowingList'
import { HistoryList } from '@/features/library/components/HistoryList'
import { useLibraryUpdateCount } from '@/features/library/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'

type Tab = 'theo-doi' | 'lich-su'

export default function LibraryPage() {
  const { data: user, isPending } = useSession()
  const [params] = useSearchParams()
  const { data: updates = 0 } = useLibraryUpdateCount()
  const current = useCurrentPath()

  if (isPending) return <PageLoader />
  // Khách mặc định xem lịch sử (tab theo dõi cần tài khoản)
  const tab: Tab =
    params.get('muc') === 'lich-su' || (!user && params.get('muc') !== 'theo-doi')
      ? 'lich-su'
      : 'theo-doi'

  return (
    <Container className="py-10">
      <title>{`Tủ truyện | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold">Tủ truyện</h1>
          <p className="mt-1 text-muted-foreground">
            Truyện bạn theo dõi và những chương đang đọc dở.
          </p>
        </div>
        <SegmentedLinks
          label="Mục trong tủ truyện"
          replace
          items={[
            {
              key: 'theo-doi',
              to: { search: '?muc=theo-doi' },
              active: tab === 'theo-doi',
              label: (
                <>
                  Đang theo dõi
                  {updates > 0 && (
                    <span className="rounded-full bg-neon px-1.5 text-[0.7rem] leading-4 font-semibold text-background">
                      {updates}
                      <span className="sr-only"> truyện có chương mới</span>
                    </span>
                  )}
                </>
              ),
            },
            {
              key: 'lich-su',
              to: { search: '?muc=lich-su' },
              active: tab === 'lich-su',
              label: 'Lịch sử đọc',
            },
          ]}
        />
      </div>

      <div className="mt-8">
        {tab === 'lich-su' ? (
          <>
            {!user && (
              <p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Lịch sử đang lưu trên trình duyệt này.{' '}
                <Link
                  to={paths.login(current)}
                  className="font-medium text-rose-gold underline-offset-4 hover:underline"
                >
                  Đăng nhập
                </Link>{' '}
                để giữ lịch sử trong tài khoản.
              </p>
            )}
            <HistoryList />
          </>
        ) : user ? (
          <FollowingList />
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-heading text-2xl font-semibold">Đăng nhập để theo dõi truyện</p>
            <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
              Theo dõi truyện để biết ngay khi có chương mới, trên mọi thiết bị.
            </p>
            <Button asChild className="mt-5 h-10 rounded-full px-5">
              <Link to={paths.login(current)}>Đăng nhập</Link>
            </Button>
          </div>
        )}
      </div>
    </Container>
  )
}
