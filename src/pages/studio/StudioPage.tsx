import { MoreHorizontal, PenLine, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SITE_NAME } from '@/config/site'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { StoryCover } from '@/features/stories/StoryCover'
import type { MyStory } from '@/features/studio/api'
import { DeleteStoryDialog } from '@/features/studio/components/DeleteStoryDialog'
import { StatusBadge } from '@/features/studio/components/StatusBadge'
import { useMyStories } from '@/features/studio/hooks'
import { formatCount, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

export default function StudioPage() {
  const { data: stories, isPending, isError } = useMyStories()
  // Giữ truyện đang xóa khi đóng dialog để hiệu ứng đóng chạy hết
  const [deleting, setDeleting] = useState<MyStory | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletedTitle, setDeletedTitle] = useState<string | null>(null)

  return (
    <>
      <title>{`Sáng tác | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold">Sáng tác của bạn</h1>
          <p className="mt-1 text-muted-foreground">
            Viết luôn chương 1 khi tạo truyện, hoặc lưu nháp rồi đăng khi sẵn sàng.
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
        {deletedTitle && (
          <div className="mb-4">
            <FormAlert variant="success">Đã xóa truyện “{deletedTitle}”.</FormAlert>
          </div>
        )}
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
              <li key={s.id} className="flex items-center transition-colors hover:bg-muted/40">
                <Link
                  to={paths.studioStory(s.id)}
                  className="group grid min-w-0 flex-1 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-4 p-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]"
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
                    {s.visibility === 'published' && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatCount(s.views)} lượt đọc, {formatCount(s.followers)} theo dõi
                        {s.openReports > 0 && (
                          <span className="text-neon">, {s.openReports} báo lỗi chưa xử lý</span>
                        )}
                      </p>
                    )}
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
                {/* Nút menu nằm ngoài Link: không lồng nút trong thẻ a */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="mr-2 shrink-0 sm:mr-3"
                      aria-label={`Thao tác cho truyện ${s.title}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to={paths.studioStory(s.id, 'thong-tin')}>
                        <PenLine />
                        Sửa thông tin
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={paths.studioNewChapter(s.id)}>
                        <Plus />
                        Viết chương mới
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        setDeletedTitle(null)
                        setDeleting(s)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 />
                      Xóa truyện
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deleting && (
        <DeleteStoryDialog
          key={deleting.id}
          storyId={deleting.id}
          title={deleting.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => {
            setDeleteOpen(false)
            setDeletedTitle(deleting.title)
          }}
        />
      )}
    </>
  )
}
