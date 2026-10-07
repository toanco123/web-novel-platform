import { Skeleton } from '@/components/ui/skeleton'
import type { Story } from '@/types/story'
import { StoryListItem } from '../StoryListItem'

type Props = {
  id: string
  title: string
  stories: Story[] | undefined
  isPending: boolean
  /** Số dòng chờ khi đang tải (gần với số truyện thường có) */
  skeletonCount?: number
}

/** Khối cột phụ; ẩn hẳn khi không có truyện nào */
export function SideStoryList({ id, title, stories, isPending, skeletonCount = 3 }: Props) {
  if (!isPending && !stories?.length) return null
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 font-heading text-2xl font-semibold">
        {title}
      </h2>
      {isPending ? (
        <StoryListItemsSkeleton count={skeletonCount} />
      ) : (
        <ul className="space-y-1">
          {stories!.map((s) => (
            <li key={s.slug}>
              <StoryListItem story={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Dòng chờ cùng cỡ StoryListItem: bìa nhỏ w-10 (tỉ lệ 2/3), tên và một dòng phụ */
export function StoryListItemsSkeleton({ count }: { count: number }) {
  return (
    <ul className="space-y-1" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="aspect-[2/3] w-10 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  )
}
