import { FileUp, MoreHorizontal, PenLine, Plus } from 'lucide-react'
import { Fragment, useState } from 'react'
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
          {chapters.data.map((c, i) => {
            // Số còn trống trước chương này (tác giả bỏ qua để viết trước chương sau, hoặc đã xóa)
            const gapFrom = (i === 0 ? 0 : chapters.data[i - 1].number) + 1
            const gapTo = c.number - 1
            return (
              <Fragment key={c.id}>
                {gapFrom <= gapTo && (
                  <li className="flex items-center gap-3 bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                    <span className="min-w-10 shrink-0 whitespace-nowrap tabular-nums">
                      {gapFrom === gapTo ? gapFrom : `${gapFrom}–${gapTo}`}
                    </span>
                    <p className="min-w-0 flex-1 italic">
                      {gapFrom === gapTo ? 'Chưa viết' : `Chưa viết ${gapTo - gapFrom + 1} chương`}
                    </p>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={paths.studioNewChapter(storyId, gapFrom)}>
                        <Plus />
                        Viết chương {gapFrom}
                      </Link>
                    </Button>
                  </li>
                )}
                <li className="flex items-center gap-3 px-4 py-3">
                  <span className="w-10 shrink-0 text-sm text-muted-foreground tabular-nums">
                    {c.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.title || (
                        <span className="text-muted-foreground italic">Chưa đặt tên</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {number.format(countWords(c.content))} chữ, sửa{' '}
                      {formatRelativeTime(c.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge
                    published={c.status === 'published'}
                    className="hidden sm:inline-flex"
                  />
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
              </Fragment>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Xóa chương ${confirmDelete}?`}
        description="Chương cùng bình luận và báo lỗi của chương sẽ bị xóa vĩnh viễn, không khôi phục được."
        confirmLabel="Xóa chương"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirmDelete!, { onSettled: () => setConfirmDelete(null) })}
      />
    </div>
  )
}
