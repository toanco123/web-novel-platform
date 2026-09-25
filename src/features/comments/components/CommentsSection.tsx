import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { useComments, useMyRating, useRateStory, useRatingSummary } from '../hooks'
import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import { RatingSummary } from './RatingSummary'
import { StarRatingInput } from './StarRatingInput'

type Props = {
  slug: string
  /** Có số: bình luận của chương đó (không có phần chấm điểm) */
  chapter?: number | null
}

export function CommentsSection({ slug, chapter = null }: Props) {
  const { data: user } = useSession()
  const current = useCurrentPath()
  const comments = useComments(slug, chapter)
  const items = comments.data?.pages.flatMap((p) => p.items) ?? []

  const loginLink = (text: string) => (
    <Link
      to={paths.login(current)}
      className="font-medium text-rose-gold underline-offset-4 hover:underline"
    >
      {text}
    </Link>
  )

  return (
    <div className="space-y-8">
      {chapter === null && (
        <RatingPanel slug={slug} signedIn={!!user} loginLink={loginLink('Đăng nhập')} />
      )}

      {user ? (
        <CommentForm slug={slug} user={user} chapter={chapter} />
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          {loginLink('Đăng nhập')} để viết bình luận.
        </p>
      )}

      {comments.isError ? (
        <SectionError />
      ) : comments.isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nhận.
        </p>
      ) : (
        <div>
          <ul
            className="divide-y"
            aria-label={chapter === null ? 'Danh sách bình luận' : `Bình luận chương ${chapter}`}
          >
            {items.map((c) => (
              <li key={c.id}>
                <CommentItem comment={c} isOwn={c.user.id === user?.id} />
              </li>
            ))}
          </ul>
          {comments.hasNextPage && (
            <Button
              variant="outline"
              onClick={() => comments.fetchNextPage()}
              disabled={comments.isFetchingNextPage}
              className="mt-4 h-10 w-full rounded-full"
            >
              {comments.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm bình luận'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function RatingPanel({
  slug,
  signedIn,
  loginLink,
}: {
  slug: string
  signedIn: boolean
  loginLink: ReactNode
}) {
  const summary = useRatingSummary(slug)
  return (
    <div className="grid gap-6 rounded-xl border bg-card/50 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
      {summary.data ? (
        <RatingSummary summary={summary.data} />
      ) : (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      )}
      <div className="border-t pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
        <p className="mb-2 text-sm font-medium">Đánh giá của bạn</p>
        {signedIn ? (
          <MyRating slug={slug} />
        ) : (
          <p className="text-sm text-muted-foreground">{loginLink} để chấm điểm truyện.</p>
        )}
      </div>
    </div>
  )
}

function MyRating({ slug }: { slug: string }) {
  const mine = useMyRating(slug)
  const rate = useRateStory(slug)
  const value = rate.isPending ? rate.variables : (mine.data ?? null)

  return (
    <div>
      <StarRatingInput value={value} onChange={(s) => rate.mutate(s)} disabled={mine.isPending} />
      <p className="mt-1.5 h-4 text-xs text-muted-foreground" role="status">
        {rate.isSuccess && `Đã lưu: ${rate.data} sao. Cảm ơn bạn!`}
        {rate.isError && <span className="text-destructive">Chưa lưu được điểm. Thử lại nhé.</span>}
      </p>
    </div>
  )
}
