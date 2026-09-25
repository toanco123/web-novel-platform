import { cn } from '@/lib/utils'
import type { Story } from '@/types/story'
import { coverPalette } from './coverPalette'

type Props = {
  story: Pick<Story, 'slug' | 'title' | 'coverUrl' | 'author'>
  /** Bìa cỡ nhỏ (thumbnail, bảng xếp hạng): chỉ giữ màu và khung, bỏ chữ */
  compact?: boolean
  className?: string
}

export function StoryCover({ story, compact = false, className }: Props) {
  if (story.coverUrl) {
    return (
      <img
        src={story.coverUrl}
        alt={`Bìa truyện ${story.title}`}
        loading="lazy"
        className={cn('aspect-[2/3] w-full object-cover', className)}
      />
    )
  }

  const p = coverPalette(story.slug)
  return (
    <div
      role="img"
      aria-label={`Bìa truyện ${story.title}`}
      className={cn('@container relative aspect-[2/3] w-full overflow-hidden', className)}
      style={{
        background: `radial-gradient(120% 70% at 30% 0%, ${p.from} 0%, transparent 70%), linear-gradient(165deg, ${p.from}, ${p.to})`,
        color: p.ink,
      }}
    >
      {compact ? (
        <div className="absolute inset-[10%] border border-current/35" />
      ) : (
        <div className="absolute inset-[6%] flex flex-col items-center justify-between border border-current/35 px-[8%] py-[12%] text-center">
          <span aria-hidden className="h-px w-1/4 bg-current/60" />
          <p className="font-heading text-[clamp(0.75rem,13cqw,2.75rem)] leading-[1.05] font-semibold text-balance italic">
            {story.title}
          </p>
          <p className="text-[clamp(0.5rem,6cqw,0.9rem)] opacity-75">{story.author.name}</p>
        </div>
      )}
    </div>
  )
}
