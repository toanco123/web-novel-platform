import { Link } from 'react-router'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import type { Story } from '@/types/story'
import { StoryCover } from './StoryCover'

/** Một dòng truyện gọn: bìa nhỏ, tên, lượt đọc (cột phụ, danh sách ngắn) */
export function StoryListItem({ story }: { story: Story }) {
  return (
    <Link
      to={paths.story(story.slug)}
      className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60"
    >
      <StoryCover story={story} compact className="w-10 shrink-0 rounded" />
      <span className="min-w-0">
        <span className="line-clamp-1 text-sm font-medium group-hover:text-primary">
          {story.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {story.genres[0]?.name}, {formatCount(story.viewCount)} lượt đọc
        </span>
      </span>
    </Link>
  )
}
