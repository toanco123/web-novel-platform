import { zodResolver } from '@hookform/resolvers/zod'
import { History } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { authInputClass, FormField } from '@/features/auth/components/FormField'
import { paths } from '@/lib/routes'
import { cn } from '@/lib/utils'
import type { Chapter } from '@/types/chapter'
import type { MyStory } from '../api'
import { studioErrorMessage } from '../errors'
import { useSaveChapter } from '../hooks'
import { chapterSchema, CONTENT_MAX, countWords, type ChapterValues } from '../schemas'
import { useEditorAutosave } from '../useEditorAutosave'
import { useUnsavedChangesPrompt } from '../useUnsavedChangesPrompt'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusBadge } from './StatusBadge'

const number = new Intl.NumberFormat('vi-VN')
const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })

type Props = {
  story: MyStory
  /** null: chương mới */
  chapter: Chapter | null
  nextNumber: number
}

export function ChapterEditor({ story, chapter, nextNumber }: Props) {
  const navigate = useNavigate()
  const save = useSaveChapter(story.id)
  const loaded = { title: chapter?.title ?? '', content: chapter?.content ?? '' }
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ChapterValues>({
    resolver: zodResolver(chapterSchema),
    mode: 'onTouched',
    defaultValues: loaded,
  })
  const values = useWatch({ control }) as ChapterValues
  const autosave = useEditorAutosave(
    `editor-draft:${story.id}:${chapter?.number ?? 'new'}`,
    values,
    isDirty,
    loaded,
  )
  const leave = useUnsavedChangesPrompt(isDirty && !save.isPending)

  const isPublished = chapter?.status === 'published'
  const title = chapter ? `Chương ${chapter.number}` : `Chương mới (số ${nextNumber})`

  const submit = (publish: boolean) =>
    handleSubmit((v) =>
      save.mutate(
        { ...v, number: chapter?.number, publish },
        {
          onSuccess: () => {
            autosave.clear()
            leave.allowNextNavigation()
            navigate(paths.studioStory(story.id))
          },
        },
      ),
    )

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="pb-28">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-4xl font-semibold">{title}</h1>
        {chapter && <StatusBadge published={isPublished} />}
      </div>
      <p className="mt-1 mb-6 text-muted-foreground">{story.title}</p>

      {autosave.restorable && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-rose-gold/40 bg-rose-gold/10 px-4 py-3 text-sm">
          <History className="size-4 shrink-0 text-rose-gold" aria-hidden />
          <p className="flex-1">
            Bạn có bản đang viết dở lúc {clock.format(new Date(autosave.restorable.savedAt))}. Khôi
            phục?
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const { title, content } = autosave.restorable!
              reset({ title, content }, { keepDefaultValues: true })
              autosave.dismiss()
            }}
          >
            Khôi phục
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={autosave.dismiss}>
            Bỏ bản này
          </Button>
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        {save.isError && <FormAlert>{studioErrorMessage(save.error)}</FormAlert>}
        <FormField
          id="chapter-title"
          label="Tiêu đề chương (không bắt buộc)"
          error={errors.title?.message}
        >
          {(c) => (
            <Input
              {...c}
              {...register('title')}
              autoComplete="off"
              placeholder="Ví dụ: Gặp lại"
              className={authInputClass}
            />
          )}
        </FormField>
        <FormField
          id="chapter-content"
          label="Nội dung"
          error={errors.content?.message}
          below={
            <p
              className={cn(
                'text-xs text-muted-foreground tabular-nums',
                values.content.length > CONTENT_MAX && 'text-destructive',
              )}
            >
              {number.format(countWords(values.content))} chữ,{' '}
              {number.format(values.content.length)}/{number.format(CONTENT_MAX)} ký tự. Các đoạn
              cách nhau bằng một dòng trống.
            </p>
          }
        >
          {(c) => (
            <textarea
              {...c}
              {...register('content')}
              placeholder="Bắt đầu viết chương của bạn…"
              className="field-sizing-content min-h-[50vh] w-full rounded-lg border border-input bg-transparent px-4 py-3 font-heading text-lg leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
            />
          )}
        </FormField>
      </div>

      {/* Thanh thao tác dính dưới đáy màn hình */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 md:px-6">
          <p className="mr-auto text-xs text-muted-foreground" role="status">
            {save.isPending
              ? 'Đang lưu…'
              : autosave.savedAt
                ? `Đã tự lưu bản nháp trong trình duyệt lúc ${clock.format(autosave.savedAt)}`
                : isDirty
                  ? 'Có thay đổi chưa lưu'
                  : ''}
          </p>
          <Button asChild type="button" variant="ghost">
            <Link to={paths.studioStory(story.id)}>Hủy</Link>
          </Button>
          {isPublished ? (
            <Button type="button" disabled={save.isPending} onClick={submit(false)}>
              Lưu thay đổi
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={submit(false)}
              >
                Lưu nháp
              </Button>
              <Button type="button" disabled={save.isPending} onClick={submit(true)}>
                Xuất bản chương
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={leave.blocker.state === 'blocked'}
        onOpenChange={(open) => !open && leave.blocker.reset?.()}
        title="Rời trang khi chưa lưu?"
        description="Nội dung đang viết vẫn được giữ trong trình duyệt; lần sau mở lại chương này bạn có thể khôi phục."
        cancelLabel="Ở lại viết tiếp"
        confirmLabel="Rời trang"
        onConfirm={() => {
          autosave.flush()
          leave.blocker.proceed?.()
        }}
      />
    </form>
  )
}
