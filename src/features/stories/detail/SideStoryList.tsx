import type { Story } from '@/types/story'
import { StoryListItem } from '../StoryListItem'

type Props = {
  id: string
  title: string
  stories: Story[] | undefined
  isPending: boolean
}

/** Khối cột phụ; ẩn hẳn khi không có truyện nào */
export function SideStoryList({ id, title, stories, isPending }: Props) {
  if (!isPending && !stories?.length) return null
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 font-heading text-2xl font-semibold">
        {title}
      </h2>
      <ul className="space-y-1">
        {isPending
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))
          : stories!.map((s) => (
              <li key={s.slug}>
                <StoryListItem story={s} />
              </li>
            ))}
      </ul>
    </section>
  )
}
