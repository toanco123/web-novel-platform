import { X } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { StoryCover } from '@/features/stories/StoryCover'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import type { HistoryItem } from '@/types/library'
import { useClearHistory, useReadingHistory, useRemoveFromHistory } from '../hooks'
import { resumeState } from '../resume'
import { ListSkeleton } from './FollowingList'
import { ProgressMeter } from './ProgressMeter'

export function HistoryList() {
  const { data, isPending, isError } = useReadingHistory()

  if (isError) return <SectionError />
  if (isPending) return <ListSkeleton />
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-heading text-2xl font-semibold">Chưa có lịch sử đọc</p>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
          Truyện bạn mở đọc sẽ hiện ở đây, kèm chỗ đọc dở để đọc tiếp ngay.
        </p>
        <Button asChild className="mt-5 h-10 rounded-full px-5">
          <Link to={paths.latest}>Xem truyện mới cập nhật</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{data.length} truyện đã đọc gần đây</p>
        <ClearHistoryButton />
      </div>
      <ul className="divide-y rounded-xl border bg-card/40" aria-label="Lịch sử đọc">
        {data.map((item) => (
          <li key={item.story.slug}>
            <HistoryRow item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function HistoryRow({ item: { story, progress } }: { item: HistoryItem }) {
  const remove = useRemoveFromHistory()
  return (
    <article className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center">
      <Link to={paths.story(story.slug)} tabIndex={-1} aria-hidden className="self-start">
        <StoryCover story={story} compact className="rounded" />
      </Link>
      <div className="min-w-0">
        <h3 className="font-medium">
          <Link to={paths.story(story.slug)} className="line-clamp-1 hover:text-primary">
            {story.title}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
          Chương {progress.chapter}
          {progress.chapterTitle && `: ${progress.chapterTitle}`}
          <span className="text-muted-foreground/70">
            {' · '}
            <time dateTime={progress.readAt}>{formatRelativeTime(progress.readAt)}</time>
          </span>
        </p>
        <ProgressMeter value={progress.progress} className="mt-2 max-w-xs" />
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <Button asChild className="h-9 flex-1 rounded-full px-4 sm:flex-none">
          <Link to={paths.chapter(story.slug, progress.chapter)} state={resumeState(progress)}>
            Đọc tiếp
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full text-muted-foreground hover:text-destructive"
          aria-label={`Xóa ${story.title} khỏi lịch sử`}
          title="Xóa khỏi lịch sử"
          disabled={remove.isPending}
          onClick={() => remove.mutate(story.slug)}
        >
          <X />
        </Button>
      </div>
    </article>
  )
}

function ClearHistoryButton() {
  const clear = useClearHistory()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          Xóa toàn bộ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Xóa toàn bộ lịch sử đọc?</DialogTitle>
          <DialogDescription>
            Chỗ đọc dở của mọi truyện sẽ mất. Truyện trong tủ vẫn được giữ.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Giữ lại</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" disabled={clear.isPending} onClick={() => clear.mutate()}>
              Xóa lịch sử
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
