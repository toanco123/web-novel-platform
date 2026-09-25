import { BookOpen, Eye, Star } from 'lucide-react'
import { Link } from 'react-router'
import { formatCount } from '@/lib/format'
import { paths } from '@/lib/routes'
import type { Story } from '@/types/story'
import { StoryCover } from './StoryCover'

/** Một dòng truyện đầy đủ thông tin (kết quả tìm kiếm): bìa, tên, tác giả, mô tả, số liệu */
export function StoryRow({ story }: { story: Story }) {
  return (
    <article className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-5">
      <div className="overflow-hidden rounded-md ring-1 ring-border">
        <StoryCover story={story} />
      </div>
      <div className="min-w-0">
        <h3 className="font-heading text-xl leading-tight font-semibold sm:text-2xl">
          {/* Cả dòng bấm được nhờ lớp phủ của link tên truyện */}
          <Link
            to={paths.story(story.slug)}
            className="after:absolute after:inset-0 hover:text-primary"
          >
            {story.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {story.author.name}
          {story.genres.length > 0 && (
            <span className="text-rose-gold">
              {' · '}
              {story.genres
                .slice(0, 3)
                .map((g) => g.name)
                .join(', ')}
            </span>
          )}
        </p>
        <p className="mt-1.5 line-clamp-2 text-sm text-foreground/80">{story.description}</p>
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Số chương</dt>
            <BookOpen className="size-3.5" aria-hidden />
            <dd>
              {story.chapterCount} chương, {story.status === 'completed' ? 'hoàn thành' : 'đang ra'}
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="sr-only">Lượt đọc</dt>
            <Eye className="size-3.5" aria-hidden />
            <dd>{formatCount(story.viewCount)}</dd>
          </div>
          {story.ratingCount > 0 && (
            <div className="flex items-center gap-1">
              <dt className="sr-only">Đánh giá</dt>
              <Star className="size-3.5 fill-rose-gold text-rose-gold" aria-hidden />
              <dd>{story.ratingAvg.toFixed(1)}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  )
}

export function StoryRowSkeleton() {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-5">
      <div className="aspect-[2/3] animate-pulse rounded-md bg-muted" />
      <div className="space-y-2">
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
