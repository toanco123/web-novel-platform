import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold,
  ChevronDown,
  Italic,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  SquareDashedText,
  Strikethrough,
  TextAlignCenter,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { BulletStyle, OrderedStyle } from '@/features/chapters/richText'
import { cn } from '@/lib/utils'

const blockTypes = [
  { value: 'paragraph', label: 'Đoạn văn', className: 'text-sm' },
  { value: 'h2', label: 'Tiêu đề lớn', className: 'font-heading text-lg font-semibold' },
  { value: 'h3', label: 'Tiêu đề nhỏ', className: 'font-heading text-base font-semibold' },
] as const
type BlockType = (typeof blockTypes)[number]['value']

const bulletStyles: { value: BulletStyle; marker: string; label: string }[] = [
  { value: 'disc', marker: '●', label: 'Chấm tròn' },
  { value: 'circle', marker: '○', label: 'Vòng tròn' },
  { value: 'square', marker: '■', label: 'Ô vuông' },
]
const orderedStyles: { value: OrderedStyle; marker: string; label: string }[] = [
  { value: 'decimal', marker: '1.', label: 'Số' },
  { value: 'lower-alpha', marker: 'a.', label: 'Chữ cái' },
  { value: 'lower-roman', marker: 'i.', label: 'Số La Mã thường' },
  { value: 'upper-roman', marker: 'I.', label: 'Số La Mã hoa' },
]

type ListKind = 'bulletList' | 'orderedList'

// Phím tắt của Tiptap dùng ⌘ trên máy Apple (Ctrl+B ở đó là phím di chuyển con trỏ)
const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const formatShortcut = (shortcut: string) =>
  isApple ? shortcut.replace('Mod+', '⌘').replace('Shift+', '⇧') : shortcut.replace('Mod', 'Ctrl')

function readState(editor: Editor) {
  const block: BlockType = editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : 'paragraph'
  return {
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    block,
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    center: editor.isActive({ textAlign: 'center' }),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    bulletStyle: (editor.getAttributes('bulletList').listStyle ?? 'disc') as BulletStyle,
    orderedStyle: (editor.getAttributes('orderedList').listStyle ?? 'decimal') as OrderedStyle,
  }
}

/** Thanh định dạng của trình soạn chương (thứ tự nút theo các trình soạn quen thuộc) */
export function EditorToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({ editor, selector: ({ editor }) => readState(editor) })
  const chain = () => editor.chain().focus()

  function setBlock(value: BlockType) {
    if (value === 'paragraph') chain().setParagraph().run()
    else
      chain()
        .setHeading({ level: value === 'h2' ? 2 : 3 })
        .run()
  }

  function setListStyle(kind: ListKind, style: string, fallback: string) {
    const c = chain()
    if (!editor.isActive(kind)) {
      if (kind === 'bulletList') c.toggleBulletList()
      else c.toggleOrderedList()
    }
    c.updateAttributes(kind, { listStyle: style === fallback ? null : style }).run()
  }

  const currentBlock = blockTypes.find((b) => b.value === s.block)!

  return (
    <div
      role="toolbar"
      aria-label="Định dạng nội dung"
      aria-orientation="horizontal"
      // `contain: inline-size`: thanh không đẩy rộng cột form, hẹp thì cuộn ngang bên trong
      className="sticky top-16 z-10 flex items-center gap-0.5 overflow-x-auto rounded-t-lg border-b bg-background/95 px-1.5 py-1 backdrop-blur-xl [contain:inline-size] lg:top-28 dark:bg-card/95"
    >
      <ToolButton
        icon={Undo2}
        label="Hoàn tác"
        shortcut="Mod+Z"
        disabled={!s.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label="Làm lại"
        shortcut="Mod+Shift+Z"
        disabled={!s.canRedo}
        onClick={() => chain().redo().run()}
      />
      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Kiểu đoạn: ${currentBlock.label}`}
            className="w-32 shrink-0 justify-between font-normal"
          >
            {currentBlock.label}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuRadioGroup value={s.block} onValueChange={(v) => setBlock(v as BlockType)}>
            {blockTypes.map((b) => (
              <DropdownMenuRadioItem key={b.value} value={b.value} className={b.className}>
                {b.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Divider />

      <ToolButton
        icon={Bold}
        label="Đậm"
        shortcut="Mod+B"
        pressed={s.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Nghiêng"
        shortcut="Mod+I"
        pressed={s.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="Gạch chân"
        shortcut="Mod+U"
        pressed={s.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="Gạch ngang"
        shortcut="Mod+Shift+S"
        pressed={s.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <Divider />

      <ToolButton
        icon={SquareDashedText}
        label="Chọn tất cả"
        shortcut="Mod+A"
        onClick={() => chain().selectAll().run()}
      />
      <ToolButton
        icon={RemoveFormatting}
        label="Xóa định dạng"
        onClick={() => chain().unsetAllMarks().unsetTextAlign().run()}
      />
      <ToolButton
        icon={TextAlignCenter}
        label="Căn giữa"
        pressed={s.center}
        onClick={() =>
          s.center ? chain().unsetTextAlign().run() : chain().setTextAlign('center').run()
        }
      />
      <Divider />

      <ListButton
        icon={List}
        label="Danh sách chấm"
        menuLabel="Kiểu danh sách chấm"
        pressed={s.bulletList}
        value={s.bulletList ? s.bulletStyle : undefined}
        options={bulletStyles}
        onToggle={() => chain().toggleBulletList().run()}
        onPick={(v) => setListStyle('bulletList', v, 'disc')}
      />
      <ListButton
        icon={ListOrdered}
        label="Danh sách số"
        menuLabel="Kiểu danh sách số"
        pressed={s.orderedList}
        value={s.orderedList ? s.orderedStyle : undefined}
        options={orderedStyles}
        onToggle={() => chain().toggleOrderedList().run()}
        onPick={(v) => setListStyle('orderedList', v, 'decimal')}
      />
    </div>
  )
}

const pressedClass = 'aria-pressed:bg-primary/15 aria-pressed:text-primary'

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
}

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

type ToolButtonProps = {
  icon: LucideIcon
  label: string
  /** `Mod` = ⌘ trên máy Apple, Ctrl trên máy khác */
  shortcut?: string
  /** Có giá trị = nút bật/tắt (`aria-pressed`) */
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolButton({ icon: Icon, label, shortcut, pressed, disabled, onClick }: ToolButtonProps) {
  return (
    <Hint label={shortcut ? `${label} (${formatShortcut(shortcut)})` : label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        // Giữ vùng chọn trong trình soạn khi bấm chuột
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn('shrink-0', pressedClass)}
      >
        <Icon aria-hidden />
      </Button>
    </Hint>
  )
}

type ListButtonProps = {
  icon: LucideIcon
  label: string
  menuLabel: string
  pressed: boolean
  /** Kiểu của danh sách đang đứng trong; undefined khi không ở trong danh sách này */
  value: string | undefined
  options: { value: string; marker: string; label: string }[]
  onToggle: () => void
  onPick: (value: string) => void
}

/** Nút danh sách tách đôi: bấm để bật/tắt, mũi tên để chọn kiểu */
function ListButton({
  icon,
  label,
  menuLabel,
  pressed,
  value,
  options,
  onToggle,
  onPick,
}: ListButtonProps) {
  return (
    <div className="flex shrink-0 items-center">
      <ToolButton icon={icon} label={label} pressed={pressed} onClick={onToggle} />
      <DropdownMenu>
        <Hint label={menuLabel}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={menuLabel}
              className="-ml-0.5 w-4"
            >
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent
          align="start"
          className="w-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuRadioGroup value={value ?? ''} onValueChange={onPick}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                <span aria-hidden className="w-5 text-center text-muted-foreground tabular-nums">
                  {o.marker}
                </span>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
