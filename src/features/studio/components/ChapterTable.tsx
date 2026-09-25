import { FileUp, MoreHorizontal, PenLine, Plus } from 'lucide-react'
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
import { FormAlert } from '@/features/auth/components/FormAlert'
import { formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'
import { studioErrorMessage } from '../errors'
import { useDeleteChapter, useMyChapters, useSetChapterStatus } from '../hooks'
import { countWords } from '../schemas'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusBadge } from './StatusBadge'

const number = new Intl.NumberFormat('vi-VN')

export function ChapterTable({ storyId }: { storyId: string }) {
  const chapters = useMyChapters(storyId)
  const setStatus = useSetChapterStatus(storyId)
  const remove = useDeleteChapter(storyId)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const error = setStatus.error ?? remove.error

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button asChild className="h-10 rounded-full px-5">
          <Link to={paths.studioNewChapter(storyId)}>
            <Plus />
            Viết chương mới
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-10 rounded-full px-5">
          <Link to={paths.studioImport(storyId)}>
            <FileUp />
            Nhập từ file .txt
          </Link>
        </Button>
      </div>

      {error && <FormAlert>{studioErrorMessage(error)}</FormAlert>}

      {chapters.isError ? (
        <SectionError />
      ) : chapters.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : chapters.data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Chưa có chương nào. Viết chương đầu tiên hoặc nhập nhiều chương từ file .txt.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card/40" aria-label="Danh sách chương">
          {chapters.data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-10 shrink-0 text-sm text-muted-foreground tabular-nums">
                {c.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.title || <span className="text-muted-foreground italic">Chưa đặt tên</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {number.format(countWords(c.content))} chữ, sửa {formatRelativeTime(c.updatedAt)}
                </p>
              </div>
              <StatusBadge published={c.status === 'published'} className="hidden sm:inline-flex" />
              <Button asChild variant="ghost" size="sm" aria-label={`Sửa chương ${c.number}`}>
                <Link to={paths.studioChapter(storyId, c.number)}>
                  <PenLine />
                  <span className="hidden sm:inline">Sửa</span>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Thao tác khác cho chương ${c.number}`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <p className="px-2 py-1.5 sm:hidden">
                    <StatusBadge published={c.status === 'published'} />
                  </p>
                  <DropdownMenuItem
                    onSelect={() =>
                      setStatus.mutate({
                        number: c.number,
                        status: c.status === 'published' ? 'draft' : 'published',
                      })
                    }
                  >
                    {c.status === 'published' ? 'Chuyển về nháp' : 'Xuất bản chương'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmDelete(c.number)}
                  >
                    Xóa chương
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Xóa chương ${confirmDelete}?`}
        description="Chương sẽ bị xóa vĩnh viễn và không khôi phục được."
        confirmLabel="Xóa chương"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirmDelete!, { onSettled: () => setConfirmDelete(null) })}
      />
    </div>
  )
}
