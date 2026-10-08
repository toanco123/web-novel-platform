import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/features/auth/hooks'
import { useStory } from '@/features/stories/hooks'
import { useCurrentPath } from '@/hooks/useCurrentPath'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Comment, CommentSort } from '@/types/comment'
import { useComments, useMyRating, useRateStory, useRatingSummary } from '../hooks'
import { CommentForm } from './CommentForm'
import { CommentItem, CommentSkeleton } from './CommentItem'
import { RatingSummary } from './RatingSummary'
import { StarRatingInput } from './StarRatingInput'

type Props = {
  slug: string
  /** Có số: bình luận của chương đó (không có phần chấm điểm) */
  chapter?: number | null
}

export function CommentsSection({ slug, chapter = null }: Props) {
  // Phiên chưa rõ thì giữ chỗ, không hiện lời mời đăng nhập rồi mới đổi sang ô viết bình luận
  const { data: user, isPending: sessionPending } = useSession()
  const current = useCurrentPath()
  const [sort, setSort] = useState<CommentSort>('newest')
  const comments = useComments(slug, chapter, sort)
  const items = uniqueById(comments.data?.pages.flatMap((p) => p.items) ?? [])
  const total = comments.data?.pages[0]?.total ?? 0
  // Chủ truyện xóa được bình luận của người khác. Chỉ tải truyện khi đã đăng nhập (trang chi tiết
  // truyện đã có sẵn trong cache)
  const story = useStory(slug, { enabled: !!user })
  const canModerate = !!user && story.data?.ownerId === user.id

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
        <RatingPanel
          slug={slug}
          signedIn={sessionPending ? undefined : !!user}
          loginLink={loginLink('Đăng nhập')}
        />
      )}

      {sessionPending ? (
        <CommentFormSkeleton />
      ) : user ? (
        <CommentForm slug={slug} user={user} chapter={chapter} />
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          {loginLink('Đăng nhập')} để viết bình luận.
        </p>
      )}

      {comments.isError ? (
        <SectionError />
      ) : comments.isPending ? (
        <div className="divide-y" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nhận.
        </p>
      ) : (
        <div>
          {total >= 2 && <SortToggle value={sort} onChange={setSort} />}
          <ul
            className="divide-y"
            aria-label={chapter === null ? 'Danh sách bình luận' : `Bình luận chương ${chapter}`}
          >
            {items.map((c) => (
              <li key={c.id}>
                <CommentItem comment={c} viewer={user ?? null} canModerate={canModerate} />
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

const SORTS: { value: CommentSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'top', label: 'Nổi bật' },
]

/** Hai nút chọn thứ tự bình luận gốc (trả lời luôn cũ nhất trước) */
function SortToggle({
  value,
  onChange,
}: {
  value: CommentSort
  onChange: (sort: CommentSort) => void
}) {
  return (
    <div className="flex justify-end">
      <div
        role="radiogroup"
        aria-label="Sắp xếp bình luận"
        className="inline-flex rounded-full border p-0.5 text-xs"
      >
        {SORTS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-3 py-1 font-medium transition-colors',
              value === option.value
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Bỏ bình luận lặp lại, giữ lần xuất hiện đầu. Trang sau lấy theo vị trí: có người bình luận thêm
 * giữa hai lần tải thì bình luận cũ lùi xuống, trang sau mở đầu bằng bình luận cuối của trang trước.
 * (Ngược lại, có bình luận bị xóa thì trang sau sót một bình luận, tới lần tải lại mới hiện.)
 */
function uniqueById(comments: Comment[]) {
  const seen = new Set<string>()
  return comments.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}

/** Cùng cỡ CommentForm: ảnh đại diện, ô nhập 3 dòng, hàng đếm chữ + nút gửi */
function CommentFormSkeleton() {
  return (
    <div className="flex gap-3" aria-hidden>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-24 rounded-lg" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function RatingPanel({
  slug,
  signedIn,
  loginLink,
}: {
  slug: string
  /** undefined: phiên đăng nhập đang tải */
  signedIn: boolean | undefined
  loginLink: ReactNode
}) {
  const summary = useRatingSummary(slug)
  return (
    <div className="grid gap-6 rounded-xl border bg-card/50 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
      {summary.data ? (
        <RatingSummary summary={summary.data} />
      ) : summary.isError ? (
        <div className="text-sm text-muted-foreground">
          <p>Không tải được điểm đánh giá.</p>
          <button
            type="button"
            onClick={() => summary.refetch()}
            disabled={summary.isFetching}
            className="mt-1 font-medium text-rose-gold underline-offset-4 hover:underline disabled:opacity-60"
          >
            {summary.isFetching ? 'Đang thử lại…' : 'Thử lại'}
          </button>
        </div>
      ) : (
        <RatingSummarySkeleton />
      )}
      <div className="border-t pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
        <p className="mb-2 text-sm font-medium">Đánh giá của bạn</p>
        {signedIn === undefined ? (
          <Skeleton className="h-8 w-44" />
        ) : signedIn ? (
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
        {rate.isPending && 'Đang lưu…'}
        {rate.isSuccess && `Đã lưu: ${rate.data} sao. Cảm ơn bạn!`}
        {rate.isError && <span className="text-destructive">Chưa lưu được điểm. Thử lại nhé.</span>}
      </p>
    </div>
  )
}

/** Cùng bố cục RatingSummary: điểm lớn + sao + số lượt, cạnh 5 thanh phân bố */
function RatingSummarySkeleton() {
  return (
    <div className="flex items-center gap-6" aria-hidden>
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-14 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex h-4 items-center gap-2">
            <Skeleton className="h-3 w-7" />
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
