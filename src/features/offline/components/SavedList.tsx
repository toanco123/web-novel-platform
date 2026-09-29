import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Badge } from '@/components/ui/badge'
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
import { ListSkeleton } from '@/features/library/components/FollowingList'
import type { ResumeState } from '@/features/library/resume'
import { StoryCover } from '@/features/stories/StoryCover'
import { formatBytes } from '@/lib/format'
import { paths } from '@/lib/routes'
import { useClearSaved, useRemoveSavedStory, useSavedStories } from '../hooks'
import type { SavedStory } from '../store'

/** Tab "Đã lưu" của tủ truyện: chỉ đọc kho trên máy nên dùng được cả khi offline */
export function SavedList() {
  const { data, isPending, isError } = useSavedStories()

  if (isError) return <SectionError />
  if (isPending) return <ListSkeleton />
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-heading text-2xl font-semibold">Chưa có chương nào được lưu</p>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
          Chương bạn mở sẽ tự được lưu để đọc khi không có mạng. Muốn đọc cả truyện lúc offline thì
          bấm "Tải về đọc offline" ở trang truyện.
        </p>
      </div>
    )
  }

  const bytes = data.reduce((sum, s) => sum + s.bytes, 0)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.length} truyện · {formatBytes(bytes)} trên máy này
        </p>
        <ClearSavedButton />
      </div>
      <ul className="divide-y rounded-xl border bg-card/40" aria-label="Truyện đã lưu">
        {data.map((saved) => (
          <li key={saved.story.slug}>
            <SavedRow saved={saved} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SavedRow({ saved }: { saved: SavedStory }) {
  const remove = useRemoveSavedStory()
  const { story, numbers, resume } = saved
  const range = numbers.length > 1 ? `${numbers[0]}–${numbers.at(-1)}` : `${numbers[0]}`
  const resumeAt: ResumeState = { resume: resume.progress }

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
          Đã lưu {numbers.length} chương ({range}) · {formatBytes(saved.bytes)}
        </p>
        {saved.pinned && (
          <Badge variant="secondary" className="mt-2">
            Đã tải về
          </Badge>
        )}
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <Button asChild className="h-9 flex-1 rounded-full px-4 sm:flex-none">
          <Link to={paths.chapter(story.slug, resume.number)} state={resumeAt}>
            Đọc tiếp
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full text-muted-foreground hover:text-destructive"
          aria-label={`Xóa ${story.title} khỏi máy`}
          title="Xóa khỏi máy"
          disabled={remove.isPending}
          onClick={() => remove.mutate(story.slug)}
        >
          <Trash2 />
        </Button>
      </div>
    </article>
  )
}

function ClearSavedButton() {
  const clear = useClearSaved()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          Xóa tất cả
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Xóa mọi chương đã lưu?</DialogTitle>
          <DialogDescription>
            Chương đã lưu và đã tải về trên máy này sẽ bị xóa. Lịch sử đọc và tủ truyện vẫn được
            giữ.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Giữ lại</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" disabled={clear.isPending} onClick={() => clear.mutate()}>
              Xóa hết
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
