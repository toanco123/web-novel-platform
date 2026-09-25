import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/components/FormAlert'
import { authInputClass, FormField } from '@/features/auth/components/FormField'
import { SubmitButton } from '@/features/auth/components/SubmitButton'
import { GenrePicker } from '@/features/genres/components/GenrePicker'
import { useGenres } from '@/features/genres/hooks'
import { StoryCard } from '@/features/stories/StoryCard'
import { slugify } from '@/lib/slugify'
import { cn } from '@/lib/utils'
import type { Story } from '@/types/story'
import { studioErrorMessage } from '../errors'
import {
  DESCRIPTION_MAX,
  storyFormSchema,
  type ChapterValues,
  type StoryFormValues,
  type StoryValues,
} from '../schemas'
import { useUnsavedChangesPrompt } from '../useUnsavedChangesPrompt'
import { ChapterFields } from './ChapterFields'
import { ConfirmDialog } from './ConfirmDialog'
import { CoverUpload } from './CoverUpload'

export type StorySubmitExtra = {
  /** Chương 1 viết kèm; null khi để trống (hoặc form sửa truyện) */
  chapter: ChapterValues | null
  /** Bấm "Đăng truyện": xuất bản chương 1 và công khai truyện luôn */
  publish: boolean
  /** Gọi trước khi tự điều hướng sau khi lưu thành công (bỏ hỏi rời trang) */
  allowLeave: () => void
}

type Props = {
  defaultValues?: StoryValues
  /** Đường dẫn cố định của truyện đã tạo; truyện mới thì xem trước từ tên */
  slug?: string
  authorName: string
  submitLabel: string
  pendingLabel: string
  pending: boolean
  error?: unknown
  success?: string | null
  /** Truyện mới: thêm phần viết chương 1 và nút "Đăng truyện" cạnh nút lưu */
  firstChapter?: boolean
  onSubmit: (values: StoryValues, extra: StorySubmitExtra) => void
}

const empty: StoryValues = {
  title: '',
  description: '',
  genreSlugs: [],
  status: 'ongoing',
  coverUrl: null,
}

export function StoryForm({
  defaultValues = empty,
  slug,
  authorName,
  submitLabel,
  pendingLabel,
  pending,
  error,
  success,
  firstChapter = false,
  onSubmit,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    mode: 'onTouched',
    defaultValues: { ...defaultValues, chapter: { title: '', content: '' } },
  })
  const values = useWatch({ control }) as StoryFormValues
  const previewSlug = slug ?? (slugify(values.title) || 'ten-truyen')
  const leave = useUnsavedChangesPrompt(
    firstChapter && values.chapter.content.trim() !== '' && !pending,
  )

  const submit = (publish: boolean) =>
    handleSubmit(({ chapter, ...story }) => {
      if (publish && !chapter.content) {
        setError(
          'chapter.content',
          { message: 'Viết nội dung chương 1 để đăng truyện (hoặc bấm Lưu nháp)' },
          { shouldFocus: true },
        )
        return
      }
      onSubmit(story, {
        chapter: firstChapter && chapter.content ? chapter : null,
        publish,
        allowLeave: leave.allowNextNavigation,
      })
    })

  return (
    <form
      onSubmit={submit(false)}
      noValidate
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]"
    >
      <div className="space-y-6">
        {error !== undefined && error !== null && (
          <FormAlert>{studioErrorMessage(error)}</FormAlert>
        )}
        {success && <FormAlert variant="success">{success}</FormAlert>}

        <FormField
          id="story-title"
          label="Tên truyện"
          error={errors.title?.message}
          below={
            <p className="text-xs break-all text-muted-foreground">
              Đường dẫn: /truyen/{previewSlug}
              {!slug && ' (tự thêm số nếu trùng; không đổi sau khi tạo)'}
            </p>
          }
        >
          {(c) => (
            <Input {...c} {...register('title')} autoComplete="off" className={authInputClass} />
          )}
        </FormField>

        <FormField
          id="story-description"
          label="Giới thiệu"
          error={errors.description?.message}
          below={
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {values.description.length}/{DESCRIPTION_MAX}
            </p>
          }
        >
          {(c) => (
            <Textarea
              {...c}
              {...register('description')}
              rows={7}
              placeholder="Truyện kể về ai, chuyện gì, có gì hấp dẫn?"
              className="rounded-lg px-3.5 py-3 leading-relaxed"
            />
          )}
        </FormField>

        <FormField id="story-genres" label="Thể loại (1–5)" error={errors.genreSlugs?.message}>
          {(c) => (
            <Controller
              control={control}
              name="genreSlugs"
              render={({ field }) => (
                <GenrePicker
                  {...c}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          )}
        </FormField>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Tình trạng</legend>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <div className="inline-flex rounded-full border p-0.5" role="radiogroup">
                {(
                  [
                    ['ongoing', 'Đang ra'],
                    ['completed', 'Đã hoàn thành'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={cn(
                      'cursor-pointer rounded-full px-4 py-1.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                      field.value === value
                        ? 'bg-secondary font-medium text-secondary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={value}
                      checked={field.value === value}
                      onChange={() => field.onChange(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          />
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Ảnh bìa (không bắt buộc)</legend>
          <Controller
            control={control}
            name="coverUrl"
            render={({ field }) => (
              <CoverUpload
                value={field.value}
                onChange={field.onChange}
                preview={{ slug: previewSlug, title: values.title || 'Tên truyện', authorName }}
              />
            )}
          />
        </fieldset>

        {firstChapter ? (
          <>
            <section aria-labelledby="first-chapter-heading" className="space-y-6 border-t pt-8">
              <div>
                <h2 id="first-chapter-heading" className="font-heading text-2xl font-semibold">
                  Chương 1
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Không bắt buộc. Viết luôn chương đầu, hoặc để trống rồi thêm chương hay nhập file
                  .txt ở bước sau.
                </p>
              </div>
              <ChapterFields
                idPrefix="first-chapter"
                titleField={register('chapter.title')}
                contentField={register('chapter.content')}
                contentValue={values.chapter.content}
                errors={{
                  title: errors.chapter?.title?.message,
                  content: errors.chapter?.content?.message,
                }}
                titleLabel="Tiêu đề chương"
                contentLabel="Nội dung chương 1"
                textareaClassName="min-h-72"
              />
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="outline"
                disabled={pending}
                className="h-11 rounded-lg px-5"
              >
                {submitLabel}
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={submit(true)}
                className="h-11 rounded-lg px-5"
              >
                Đăng truyện
              </Button>
              <p role="status" className="text-sm text-muted-foreground">
                {pending ? pendingLabel : ''}
              </p>
            </div>
          </>
        ) : (
          <div className="sm:w-56">
            <SubmitButton pending={pending} pendingLabel={pendingLabel}>
              {submitLabel}
            </SubmitButton>
          </div>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-32">
          <p className="mb-3 text-sm font-medium">Xem trước</p>
          <StoryPreview values={values} slug={previewSlug} authorName={authorName} />
          <p className="mt-3 text-xs text-muted-foreground">
            Người đọc sẽ thấy truyện của bạn như thế này ở trang chủ và trang thể loại.
          </p>
        </div>
      </aside>

      <ConfirmDialog
        open={leave.blocker.state === 'blocked'}
        onOpenChange={(open) => !open && leave.blocker.reset?.()}
        title="Rời trang khi chưa lưu?"
        description="Truyện và nội dung chương 1 đang viết chưa được lưu, rời trang sẽ mất."
        cancelLabel="Ở lại viết tiếp"
        confirmLabel="Rời trang"
        onConfirm={() => leave.blocker.proceed?.()}
      />
    </form>
  )
}

function StoryPreview({
  values,
  slug,
  authorName,
}: {
  values: StoryValues
  slug: string
  authorName: string
}) {
  const { data: genres = [] } = useGenres()
  const time = new Date().toISOString()
  const story: Story = {
    id: 'preview',
    slug,
    title: values.title || 'Tên truyện',
    author: { slug: '', name: authorName },
    genres: genres.filter((g) => values.genreSlugs.includes(g.slug)),
    status: values.status,
    description: values.description,
    coverUrl: values.coverUrl,
    chapterCount: 0,
    viewCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
    firstChapterNumber: null,
    latestChapter: null,
    createdAt: time,
    updatedAt: time,
    ownerId: null,
    visibility: 'draft',
  }
  // inert: chỉ để xem, không bấm được
  return (
    <div inert>
      <StoryCard story={story} />
    </div>
  )
}
