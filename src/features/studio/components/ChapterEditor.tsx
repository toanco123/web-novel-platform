import { zodResolver } from '@hookform/resolvers/zod'
import { History, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
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
import { CHAPTER_NUMBER_MAX, chapterFormSchema, type ChapterFormValues } from '../schemas'
import { useEditorAutosave } from '../useEditorAutosave'
import { useUnsavedChangesPrompt } from '../useUnsavedChangesPrompt'
import { ChapterFields } from './ChapterFields'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusBadge } from './StatusBadge'

const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })

type Props = {
  story: MyStory
  /** null: chương mới */
  chapter: Chapter | null
  /** Mọi chương của truyện: chặn trùng số và nhắc khi xuất bản bỏ qua chương */
  chapters: Chapter[]
  /** Số điền sẵn cho chương mới */
  defaultNumber: number
}

type Skipped = { prev: number; from: number; to: number }

/**
 * Người đọc đi theo thứ tự các chương đã xuất bản, nên xuất bản chương `number` thì họ đọc từ
 * chương đã xuất bản liền trước sang thẳng chương này. Trả về khoảng số bị bỏ qua (chưa viết
 * hoặc còn nháp), null nếu không bỏ qua chương nào.
 */
function skippedBefore(chapters: Chapter[], number: number, selfId?: string): Skipped | null {
  const prev = chapters.reduce(
    (max, c) =>
      c.id !== selfId && c.status === 'published' && c.number < number
        ? Math.max(max, c.number)
        : max,
    0,
  )
  return prev + 1 < number ? { prev, from: prev + 1, to: number - 1 } : null
}

function skippedMessage({ prev, from, to }: Skipped, number: number) {
  const missing = from === to ? `Chương ${from}` : `Các chương ${from}–${to}`
  const reader = prev
    ? `đọc từ chương ${prev} sang chương ${number}`
    : `bắt đầu từ chương ${number}`
  return `${missing} chưa xuất bản, nên khi xuất bản chương này người đọc sẽ ${reader}.`
}

export function ChapterEditor({ story, chapter, chapters, defaultNumber }: Props) {
  const navigate = useNavigate()
  const save = useSaveChapter(story.id)
  const [schema] = useState(() =>
    chapterFormSchema(chapters.filter((c) => c.id !== chapter?.id).map((c) => c.number)),
  )
  const loaded = {
    number: chapter?.number ?? defaultNumber,
    title: chapter?.title ?? '',
    content: chapter?.content ?? '',
  }
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ChapterFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: loaded,
  })
  const values = useWatch({ control }) as ChapterFormValues
  const autosave = useEditorAutosave(
    `editor-draft:${story.id}:${chapter?.number ?? 'new'}`,
    values,
    isDirty,
    loaded,
  )
  const leave = useUnsavedChangesPrompt(isDirty && !save.isPending)

  const isPublished = chapter?.status === 'published'
  // Đã từng xuất bản thì giữ số: link, lịch sử đọc, bình luận của người đọc đều theo số chương
  const numberLocked = !!chapter?.publishedAt
  const skipped =
    !isPublished && Number.isInteger(values.number) && values.number >= 1
      ? skippedBefore(chapters, values.number, chapter?.id)
      : null
  const numberNote = numberLocked
    ? 'Chương đã xuất bản giữ nguyên số để link và lịch sử đọc của người đọc không bị hỏng.'
    : !chapter && !skipped
      ? 'Mặc định là số tiếp theo. Đổi số nếu muốn viết trước một chương phía sau.'
      : null
  const title = chapter ? `Chương ${chapter.number}` : 'Chương mới'

  const submit = (publish: boolean) =>
    handleSubmit(({ number, ...v }) =>
      save.mutate(
        { ...v, number: chapter?.number, newNumber: number, publish },
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
              const { number, title, content } = autosave.restorable!
              reset(
                { number: number ?? values.number, title, content },
                { keepDefaultValues: true },
              )
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
          id="chapter-number"
          label="Số chương"
          error={errors.number?.message}
          below={
            <>
              {numberNote && (
                <p id="chapter-number-note" className="text-xs text-muted-foreground">
                  {numberNote}
                </p>
              )}
              {skipped && (
                <p
                  id="chapter-number-skipped"
                  className="flex gap-2.5 rounded-lg border border-rose-gold/40 bg-rose-gold/10 px-3.5 py-2.5 text-sm"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-gold" aria-hidden />
                  {skippedMessage(skipped, values.number)}
                </p>
              )}
            </>
          }
        >
          {(c) => (
            <Input
              {...c}
              aria-describedby={
                [
                  c['aria-describedby'],
                  numberNote && 'chapter-number-note',
                  skipped && 'chapter-number-skipped',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              {...register('number', { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={1}
              max={CHAPTER_NUMBER_MAX}
              step={1}
              readOnly={numberLocked}
              className={cn(
                authInputClass,
                'w-32 tabular-nums read-only:bg-muted/50 read-only:text-muted-foreground',
              )}
            />
          )}
        </FormField>
        <ChapterFields
          idPrefix="chapter"
          titleField={register('title')}
          contentField={register('content')}
          contentValue={values.content}
          errors={{ title: errors.title?.message, content: errors.content?.message }}
        />
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
