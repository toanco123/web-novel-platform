import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Story } from '@/types/story'
import { coverPalette } from './coverPalette'

type Props = {
  story: Pick<Story, 'slug' | 'title' | 'coverUrl' | 'author'> &
    Partial<Pick<Story, 'coverThumbUrl'>>
  /** Bìa cỡ nhỏ (thumbnail, bảng xếp hạng): chỉ giữ màu và khung, bỏ chữ */
  compact?: boolean
  /**
   * Ảnh lớn nằm ngay màn hình đầu (banner, đầu trang truyện): tải ngay, ưu tiên cao, dùng ảnh gốc.
   * Còn lại (thẻ, danh sách) dùng bản nhỏ 320×480 nếu có
   */
  priority?: boolean
  className?: string
}

export function StoryCover({ story, compact = false, priority = false, className }: Props) {
  // Ảnh không tải được (offline chưa có trong bộ nhớ đệm, ảnh bị xóa): bản nhỏ lỗi thì thử ảnh gốc,
  // ảnh gốc cũng lỗi thì dùng bìa chữ tự sinh
  const [failed, setFailed] = useState<string[]>([])
  const p = coverPalette(story.slug)
  const candidates = priority ? [story.coverUrl] : [story.coverThumbUrl, story.coverUrl]
  const url = candidates.find((u): u is string => !!u && !failed.includes(u))
  if (url) {
    return (
      <img
        src={url}
        alt={`Bìa truyện ${story.title}`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={() => setFailed((list) => [...list, url])}
        className={cn('aspect-[2/3] w-full object-cover', className)}
        // Màu bìa theo truyện hiện trong lúc chờ ảnh, không để ô trống
        style={{ background: `linear-gradient(165deg, ${p.from}, ${p.to})` }}
      />
    )
  }

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
