import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CommentsSection } from '@/features/comments/components/CommentsSection'
import { useComments } from '@/features/comments/hooks'

type Props = {
  slug: string
  chapter: number
  /** Thu gọn sẵn, bấm mới mở (cuộn liên tục: tránh chèn dài giữa hai chương) */
  collapsible?: boolean
}

export function ChapterComments({ slug, chapter, collapsible = false }: Props) {
  const [open, setOpen] = useState(!collapsible)
  const { data } = useComments(slug, chapter)
  const total = data?.pages[0]?.total

  if (!open) {
    return (
      <Button
        variant="outline"
        className="h-9 rounded-full px-4"
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        <MessageCircle />
        Bình luận chương {chapter}
        {total !== undefined && ` (${total})`}
      </Button>
    )
  }

  return (
    <section aria-labelledby={`chapter-${chapter}-comments`} className="w-full text-left">
      <h2
        id={`chapter-${chapter}-comments`}
        className="mb-5 flex items-baseline gap-2 font-heading text-3xl font-semibold"
      >
        Bình luận chương {chapter}
        {total !== undefined && (
          <span className="font-sans text-base font-normal text-muted-foreground">({total})</span>
        )}
      </h2>
      <CommentsSection slug={slug} chapter={chapter} />
    </section>
  )
}
