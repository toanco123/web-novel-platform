import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Story } from '@/types/story'

export function StoryDescription({ story }: { story: Story }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)

  // Chỉ hiện nút "Xem thêm" khi mô tả thật sự dài hơn 6 dòng
  useLayoutEffect(() => {
    const el = textRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [story.description])

  return (
    <div>
      <p
        id="story-description"
        ref={textRef}
        className={cn(
          'max-w-prose leading-relaxed whitespace-pre-line text-foreground/90',
          !expanded && 'line-clamp-6',
        )}
      >
        {story.description}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="story-description"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-medium text-rose-gold underline-offset-4 hover:underline"
        >
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Thể loại">
        {story.genres.map((g) => (
          <li key={g.slug}>
            <Link
              to={paths.genre(g.slug)}
              className="inline-block rounded-full border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {g.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
