import { BookmarkX, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { StoryCover } from '@/features/stories/StoryCover'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import type { LibraryItem } from '@/types/library'
import { useLibrary, useToggleFollow } from '../hooks'
import { resumeState } from '../resume'
import { ProgressMeter } from './ProgressMeter'

export function FollowingList() {
  const { data, isPending, isError } = useLibrary()

  if (isError) return <SectionError />
  if (isPending) return <ListSkeleton />
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-heading text-2xl font-semibold">Tủ truyện còn trống</p>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
          Bấm “Thêm vào tủ truyện” ở trang truyện để theo dõi. Có chương mới là thấy ngay ở đây.
        </p>
        <Button asChild className="mt-5 h-10 rounded-full px-5">
          <Link to={paths.ranking}>Xem truyện được đọc nhiều</Link>
        </Button>
      </div>
    )
  }

  const updated = data.filter((item) => item.newChapters > 0).length
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        {data.length} truyện{updated > 0 && `, ${updated} truyện có chương mới`}
      </p>
      <ul className="divide-y rounded-xl border bg-card/40" aria-label="Truyện đang theo dõi">
        {data.map((item) => (
          <li key={item.story.slug}>
            <FollowingRow item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FollowingRow({ item: { story, newChapters, progress } }: { item: LibraryItem }) {
  const unfollow = useToggleFollow(story.slug)
  const readTarget = progress
    ? { to: paths.chapter(story.slug, progress.chapter), state: resumeState(progress) }
    : story.firstChapterNumber !== null
      ? { to: paths.chapter(story.slug, story.firstChapterNumber) }
      : null

  return (
    <article className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center">
      <Link to={paths.story(story.slug)} tabIndex={-1} aria-hidden className="self-start">
        <StoryCover story={story} compact className="rounded" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 font-medium">
            <Link to={paths.story(story.slug)} className="line-clamp-1 hover:text-primary">
              {story.title}
            </Link>
          </h3>
          {newChapters > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-neon/15 px-2 py-0.5 text-xs font-semibold text-neon">
              <Sparkles className="size-3" aria-hidden />
              {newChapters} chương mới
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {story.latestChapter ? (
            <>
              Mới nhất:{' '}
              <Link
                to={paths.chapter(story.slug, story.latestChapter.number)}
                className="text-rose-gold hover:underline"
              >
                Chương {story.latestChapter.number}
              </Link>
              , <time dateTime={story.updatedAt}>{formatRelativeTime(story.updatedAt)}</time>
            </>
          ) : (
            'Chưa có chương'
          )}
        </p>
        {progress ? (
          <div className="mt-2 max-w-xs">
            <p className="mb-1 text-xs text-muted-foreground">
              Đang đọc chương {progress.chapter}/{story.chapterCount}
            </p>
            <ProgressMeter value={progress.progress} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Chưa đọc</p>
        )}
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        {readTarget && (
          <Button asChild className="h-9 flex-1 rounded-full px-4 sm:flex-none">
            <Link to={readTarget.to} state={readTarget.state}>
              {progress ? 'Đọc tiếp' : 'Đọc'}
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full text-muted-foreground hover:text-destructive"
          aria-label={`Bỏ theo dõi ${story.title}`}
          title="Bỏ theo dõi"
          disabled={unfollow.isPending}
          onClick={() => unfollow.mutate(false)}
        >
          <BookmarkX />
        </Button>
      </div>
    </article>
  )
}

export function ListSkeleton() {
  return (
    <div className="divide-y rounded-xl border">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex gap-4 p-4">
          <div className="aspect-[2/3] w-14 animate-pulse rounded bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
