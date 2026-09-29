import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { authInputClass, FormField } from '@/features/auth/components/FormField'
import { cn } from '@/lib/utils'
import { contentText } from '@/features/chapters/richText'
import { CHAPTER_NUMBER_MAX, CONTENT_MAX, countWords } from '../schemas'
import { ChapterContentEditor } from '../editor/ChapterContentEditor'

const number = new Intl.NumberFormat('vi-VN')

type Props = {
  /** Tiền tố id của hai ô: `${idPrefix}-title`, `${idPrefix}-content` */
  idPrefix: string
  titleField: UseFormRegisterReturn
  /** `field` của useController cho nội dung (trình soạn không dùng được `register`) */
  contentField: {
    value: string
    onChange: (value: string) => void
    onBlur: () => void
    /** Để react-hook-form đưa con trỏ vào ô khi có lỗi */
    ref: (instance: { focus: () => void } | null) => void
  }
  errors: { title?: string; content?: string }
  titleLabel?: string
  contentLabel?: string
  /** Chiều cao tối thiểu của vùng soạn */
  editorClassName?: string
}

/** Ô tiêu đề + nội dung chương (trình soạn chương và phần chương 1 của form tạo truyện) */
export function ChapterFields({
  idPrefix,
  titleField,
  contentField,
  errors,
  titleLabel = 'Tiêu đề chương (không bắt buộc)',
  contentLabel = 'Nội dung',
  editorClassName = 'min-h-[50vh]',
}: Props) {
  // Đếm trên chữ nhìn thấy, không tính thẻ định dạng
  const text = contentText(contentField.value)
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
              text.length > CONTENT_MAX && 'text-destructive',
            )}
          >
            {number.format(countWords(text))} chữ, {number.format(text.length)}/
            {number.format(CONTENT_MAX)} ký tự. Nhấn Enter để sang đoạn mới.
          </p>
        }
      >
        {(c) => (
          <ChapterContentEditor
            id={c.id}
            labelId={`${c.id}-label`}
            value={contentField.value}
            onChange={contentField.onChange}
            onBlur={contentField.onBlur}
            focusRef={contentField.ref}
            invalid={c['aria-invalid']}
            describedBy={c['aria-describedby']}
            className={editorClassName}
          />
        )}
      </FormField>
    </>
  )
}

type NumberFieldProps = {
  id: string
  /** register('...', { valueAsNumber: true }) */
  field: UseFormRegisterReturn
  error?: string
  readOnly?: boolean
  /** Ghi chú chữ nhỏ dưới ô */
  note?: ReactNode
  /** Cảnh báo nổi bật dưới ô */
  warning?: ReactNode
}

/** Ô "Số chương" (trình soạn chương và chương đầu tiên của form tạo truyện) */
export function ChapterNumberField({
  id,
  field,
  error,
  readOnly = false,
  note,
  warning,
}: NumberFieldProps) {
  const noteId = `${id}-note`
  const warningId = `${id}-warning`
  return (
    <FormField
      id={id}
      label="Số chương"
      error={error}
      below={
        <>
          {note && (
            <p id={noteId} className="text-xs text-muted-foreground">
              {note}
            </p>
          )}
          {warning && (
            <p
              id={warningId}
              className="flex gap-2.5 rounded-lg border border-rose-gold/40 bg-rose-gold/10 px-3.5 py-2.5 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-gold" aria-hidden />
              {warning}
            </p>
          )}
        </>
      }
    >
      {(c) => (
        <Input
          {...c}
          aria-describedby={
            [c['aria-describedby'], note && noteId, warning && warningId]
              .filter(Boolean)
              .join(' ') || undefined
          }
          {...field}
          type="number"
          inputMode="numeric"
          min={1}
          max={CHAPTER_NUMBER_MAX}
          step={1}
          readOnly={readOnly}
          className={cn(
            authInputClass,
            'w-32 tabular-nums read-only:bg-muted/50 read-only:text-muted-foreground',
          )}
        />
      )}
    </FormField>
  )
}
