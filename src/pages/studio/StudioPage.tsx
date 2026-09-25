import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/config/site'
import { StoryCover } from '@/features/stories/StoryCover'
import { StatusBadge } from '@/features/studio/components/StatusBadge'
import { useMyStories } from '@/features/studio/hooks'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

export default function StudioPage() {
  const { data: stories, isPending, isError } = useMyStories()

  return (
    <>
      <title>{`Sáng tác | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold">Sáng tác của bạn</h1>
          <p className="mt-1 text-muted-foreground">
            Truyện mới luôn là bản nháp. Thêm chương rồi xuất bản khi sẵn sàng.
          </p>
        </div>
        <Button asChild className="h-10 rounded-full px-5">
          <Link to={paths.studioNewStory()}>
            <Plus />
            Đăng truyện mới
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        {isError ? (
          <SectionError />
        ) : isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-heading text-2xl font-semibold">Bạn chưa đăng truyện nào</p>
            <p className="mt-1 text-muted-foreground">Bắt đầu với truyện đầu tiên của bạn.</p>
            <Button asChild className="mt-5 h-10 rounded-full px-5">
              <Link to={paths.studioNewStory()}>
                <Plus />
                Đăng truyện mới
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card/40">
            {stories.map((s) => (
              <li key={s.id}>
                <Link
                  to={paths.studioStory(s.id)}
                  className="group grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-4 p-4 transition-colors hover:bg-muted/40 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]"
                >
                  <StoryCover
                    story={{ ...s, author: { slug: '', name: s.owner.displayName } }}
                    compact
                    className="rounded"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:text-primary">{s.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {s.chapterCount === 0
                        ? 'Chưa có chương'
                        : `${s.chapterCount} chương${s.draftCount ? ` (${s.draftCount} nháp)` : ''}`}
                    </p>
                    <StatusBadge
                      published={s.visibility === 'published'}
                      className="mt-2 sm:hidden"
                    />
                  </div>
                  <div className="hidden flex-col items-end gap-1.5 sm:flex">
                    <StatusBadge published={s.visibility === 'published'} />
                    <span className="text-xs text-muted-foreground">
                      Sửa {formatRelativeTime(s.updatedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
