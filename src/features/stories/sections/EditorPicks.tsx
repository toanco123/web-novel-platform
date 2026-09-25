import { ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { useRef } from 'react'
import { Container } from '@/components/common/Container'
import { SectionError, SectionHeading } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { useEditorPicks } from '../hooks'
import { StoryCard, StoryCardSkeleton } from '../StoryCard'

const item = 'w-[42%] shrink-0 snap-start sm:w-40 lg:w-44'

export function EditorPicks() {
  const { data, isPending, isError } = useEditorPicks()
  const rowRef = useRef<HTMLUListElement>(null)

  const scroll = (dir: 1 | -1) =>
    rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <Container className="mt-14">
      <section aria-labelledby="editor-picks">
        <SectionHeading
          id="editor-picks"
          icon={<Flame className="size-6 text-neon" aria-hidden />}
          actions={
            <div className="hidden gap-1 sm:flex">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => scroll(-1)}
                aria-label="Cuộn sang trái"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => scroll(1)}
                aria-label="Cuộn sang phải"
              >
                <ChevronRight />
              </Button>
            </div>
          }
        >
          Truyện đề cử
        </SectionHeading>
        {isError ? (
          <SectionError />
        ) : (
          <ul
            ref={rowRef}
            className="-mx-4 scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:scroll-px-6 md:px-6"
          >
            {isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className={item}>
                    <StoryCardSkeleton />
                  </li>
                ))
              : data.map((s) => (
                  <li key={s.slug} className={item}>
                    <StoryCard story={s} />
                  </li>
                ))}
          </ul>
        )}
      </section>
    </Container>
  )
}
