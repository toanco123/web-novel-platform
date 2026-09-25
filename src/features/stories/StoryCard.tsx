import { BookOpen, Eye } from 'lucide-react'
import { Link } from 'react-router'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Story } from '@/types/story'
import { StoryCover } from './StoryCover'

export function StoryCard({ story, className }: { story: Story; className?: string }) {
  return (
    <Link to={paths.story(story.slug)} className={cn('group relative block', className)}>
      <div className="relative overflow-hidden rounded-lg ring-1 ring-border">
        <StoryCover
          story={story}
          className="transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.06]"
        />
        {story.status === 'completed' && (
          <span className="absolute top-2 left-2 rounded-sm bg-rose-gold px-1.5 py-0.5 text-[0.65rem] font-semibold text-background">
            Full
          </span>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm leading-snug font-medium group-hover:text-primary">
        {story.title}
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs whitespace-nowrap text-muted-foreground">
        <span className="flex items-center gap-1">
          <Eye className="size-3.5" aria-hidden />
          <span className="sr-only">Lượt xem:</span>
          {formatCount(story.viewCount)}
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="size-3.5" aria-hidden />
          {story.chapterCount} chương
        </span>
      </div>
    </Link>
  )
}

export function StoryCardSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] animate-pulse rounded-lg bg-muted" />
      <div className="mt-2.5 h-4 w-4/5 animate-pulse rounded bg-muted" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  )
}
