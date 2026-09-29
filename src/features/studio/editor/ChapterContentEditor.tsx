import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { toEditorHtml } from '@/features/chapters/richText'
import { cn } from '@/lib/utils'
import { EditorToolbar } from './EditorToolbar'
import { chapterEditorExtensions } from './extensions'

type Props = {
  id: string
  /** id của nhãn: ô soạn không phải thẻ `<textarea>` nên gắn nhãn bằng `aria-labelledby` */
  labelId: string
  value: string
  /** Trả về HTML của trình soạn, '' khi ô trống */
  onChange: (value: string) => void
  onBlur: () => void
  /** Nhận đối tượng có `focus()` (ref của react-hook-form) */
  focusRef?: (instance: { focus: () => void } | null) => void
  invalid?: boolean
  describedBy?: string
  placeholder?: string
  /** Chiều cao tối thiểu của vùng soạn, vd `min-h-[50vh]` */
  className?: string
}

/** Ô soạn nội dung chương có thanh định dạng (Tiptap). Giá trị lưu xem `features/chapters/richText` */
export function ChapterContentEditor({
  id,
  labelId,
  value,
  onChange,
  onBlur,
  focusRef,
  invalid = false,
  describedBy,
  placeholder = 'Bắt đầu viết chương của bạn…',
  className,
}: Props) {
  // Giá trị trình soạn vừa phát ra: khác giá trị form nghĩa là form bị đặt lại từ ngoài (khôi phục nháp)
  const emitted = useRef(value)
  const latest = useRef({ onChange, onBlur })
  useEffect(() => {
    latest.current = { onChange, onBlur }
  })
  const [extensions] = useState(() => chapterEditorExtensions(placeholder))

  const editor = useEditor({
    extensions,
    content: toEditorHtml(value),
    onUpdate: ({ editor }) => {
      emitted.current = editor.isEmpty ? '' : editor.getHTML()
      latest.current.onChange(emitted.current)
    },
    onBlur: () => latest.current.onBlur(),
  })

  useEffect(() => {
    editor.setOptions({
      editorProps: {
        attributes: {
          id,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-labelledby': labelId,
          'aria-invalid': String(invalid),
          ...(describedBy && { 'aria-describedby': describedBy }),
          class: cn('chapter-editor-content px-4 py-3 outline-none', className),
        },
      },
    })
  }, [editor, id, labelId, invalid, describedBy, className])

  useEffect(() => {
    focusRef?.({ focus: () => editor.commands.focus() })
    return () => focusRef?.(null)
  }, [editor, focusRef])

  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false })
  }, [editor, value])

  return (
    <div
      data-invalid={invalid || undefined}
      className="rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive dark:bg-input/30"
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
