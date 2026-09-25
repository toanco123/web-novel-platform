import type { UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { authInputClass, FormField } from '@/features/auth/components/FormField'
import { cn } from '@/lib/utils'
import { CONTENT_MAX, countWords } from '../schemas'

const number = new Intl.NumberFormat('vi-VN')

type Props = {
  /** Tiền tố id của hai ô: `${idPrefix}-title`, `${idPrefix}-content` */
  idPrefix: string
  titleField: UseFormRegisterReturn
  contentField: UseFormRegisterReturn
  /** Nội dung hiện tại, để đếm chữ */
  contentValue: string
  errors: { title?: string; content?: string }
  titleLabel?: string
  contentLabel?: string
  textareaClassName?: string
}

/** Ô tiêu đề + nội dung chương (trình soạn chương và phần chương 1 của form tạo truyện) */
export function ChapterFields({
  idPrefix,
  titleField,
  contentField,
  contentValue,
  errors,
  titleLabel = 'Tiêu đề chương (không bắt buộc)',
  contentLabel = 'Nội dung',
  textareaClassName = 'min-h-[50vh]',
}: Props) {
  return (
    <>
      <FormField id={`${idPrefix}-title`} label={titleLabel} error={errors.title}>
        {(c) => (
          <Input
            {...c}
            {...titleField}
            autoComplete="off"
            placeholder="Ví dụ: Gặp lại"
            className={authInputClass}
          />
        )}
      </FormField>
      <FormField
        id={`${idPrefix}-content`}
        label={contentLabel}
        error={errors.content}
        below={
          <p
            className={cn(
              'text-xs text-muted-foreground tabular-nums',
              contentValue.length > CONTENT_MAX && 'text-destructive',
            )}
          >
            {number.format(countWords(contentValue))} chữ, {number.format(contentValue.length)}/
            {number.format(CONTENT_MAX)} ký tự. Các đoạn cách nhau bằng một dòng trống.
          </p>
        }
      >
        {(c) => (
          <textarea
            {...c}
            {...contentField}
            placeholder="Bắt đầu viết chương của bạn…"
            className={cn(
              'field-sizing-content w-full rounded-lg border border-input bg-transparent px-4 py-3 font-heading text-lg leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30',
              textareaClassName,
            )}
          />
        )}
      </FormField>
    </>
  )
}
