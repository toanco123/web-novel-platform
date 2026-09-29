import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import { TextAlign } from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'

/** Kiểu danh sách không mặc định lưu ở `data-style` (xem `features/chapters/richText.ts`) */
const listStyleAttribute = {
  listStyle: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-style'),
    renderHTML: (attrs: { listStyle?: string | null }) =>
      attrs.listStyle ? { 'data-style': attrs.listStyle } : {},
  },
}

/**
 * Schema của trình soạn khớp đúng những gì `richText.ts` giữ lại: đoạn, tiêu đề lớn/nhỏ, danh
 * sách một cấp, đậm/nghiêng/gạch chân/gạch ngang, căn giữa. Dán nội dung khác vào sẽ bị bỏ định dạng.
 */
export function chapterEditorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      trailingNode: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
    }),
    BulletList.extend({ addAttributes: () => listStyleAttribute }),
    // Bỏ `start`/`type` của Tiptap: trang đọc luôn đánh số từ đầu theo kiểu `listStyle`
    OrderedList.extend({ addAttributes: () => listStyleAttribute }),
    // Mục danh sách chỉ chứa đoạn văn: không lồng danh sách (cần `+` để bọc nhiều đoạn một lúc)
    ListItem.extend({ content: 'paragraph+' }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center'] }),
    Placeholder.configure({ placeholder }),
  ]
}
