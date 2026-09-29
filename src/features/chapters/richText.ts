/**
 * Nội dung chương có định dạng: HTML rút gọn do trình soạn tạo ra, hoặc văn bản thuần kiểu cũ
 * (đoạn cách nhau bằng dòng trống: chương cũ, chương nhập từ file .txt).
 *
 * HTML không bao giờ được render thẳng: `parseContent` lọc ra mô hình khối chỉ gồm các định dạng
 * cho phép, trang đọc dựng lại từ mô hình đó bằng React, còn `normalizeContent` dựng lại HTML sạch
 * để lưu.
 */

export type Inline = {
  /** `\n` là xuống dòng trong đoạn (`<br>`) */
  text: string
  bold?: true
  italic?: true
  underline?: true
  strike?: true
}

export type TextBlock = {
  type: 'paragraph' | 'heading'
  /** Chỉ có ở tiêu đề: 2 = tiêu đề lớn, 3 = tiêu đề nhỏ */
  level?: 2 | 3
  align?: 'center'
  inlines: Inline[]
}

export const BULLET_STYLES = ['disc', 'circle', 'square'] as const
export const ORDERED_STYLES = ['decimal', 'lower-alpha', 'lower-roman', 'upper-roman'] as const
export type BulletStyle = (typeof BULLET_STYLES)[number]
export type OrderedStyle = (typeof ORDERED_STYLES)[number]
export type ListStyle = BulletStyle | OrderedStyle

export type ListBlock = {
  type: 'list'
  ordered: boolean
  /** Không có = kiểu mặc định (chấm tròn / 1. 2. 3.) */
  style?: ListStyle
  /** Danh sách một cấp: mỗi mục là một dòng chữ */
  items: Inline[][]
}

export type Block = TextBlock | ListBlock

type Marks = Omit<Inline, 'text'>
const MARK_KEYS = ['bold', 'italic', 'underline', 'strike'] as const
const MARK_TAGS: Record<(typeof MARK_KEYS)[number], string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
}
const TAG_MARKS: Record<string, keyof Marks> = {
  STRONG: 'bold',
  B: 'bold',
  EM: 'italic',
  I: 'italic',
  U: 'underline',
  S: 'strike',
  STRIKE: 'strike',
  DEL: 'strike',
}
/** Bỏ cả chữ bên trong */
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT'])

/** Nội dung bắt đầu bằng thẻ khối là HTML của trình soạn; còn lại là văn bản thuần kiểu cũ */
export const isRichContent = (content: string) => /^\s*<(p|h[23]|ul|ol)[\s>]/i.test(content)

/** Tách đoạn văn bản thuần theo dòng trống */
export const toParagraphs = (content: string) =>
  content
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

export function parseContent(content: string): Block[] {
  if (!isRichContent(content)) {
    return toParagraphs(content).map((text) => ({ type: 'paragraph', inlines: [{ text }] }))
  }
  // DOMParser không chạy script và không tải ảnh; chỉ dùng để đọc cây thẻ
  const doc = new DOMParser().parseFromString(content, 'text/html')
  const blocks: Block[] = []
  readBlocks(doc.body, blocks)
  return blocks
}

function readBlocks(parent: Node, blocks: Block[]) {
  let loose: Inline[] = []
  const flushLoose = () => {
    pushText(blocks, { type: 'paragraph', inlines: loose })
    loose = []
  }
  for (const node of Array.from(parent.childNodes)) {
    if (!(node instanceof Element)) {
      if (node.nodeType === Node.TEXT_NODE) readInlines(node, {}, loose)
      continue
    }
    const tag = node.tagName
    if (DROPPED_TAGS.has(tag)) continue
    if (tag === 'P' || tag === 'DIV' || /^H[1-6]$/.test(tag)) {
      flushLoose()
      const heading = /^H[1-6]$/.test(tag)
      const inlines: Inline[] = []
      readInlines(node, {}, inlines)
      pushText(blocks, {
        type: heading ? 'heading' : 'paragraph',
        ...(heading && { level: tag === 'H1' || tag === 'H2' ? 2 : 3 }),
        ...(/text-align:\s*center/i.test(node.getAttribute('style') ?? '') && {
          align: 'center',
        }),
        inlines,
      })
    } else if (tag === 'UL' || tag === 'OL') {
      flushLoose()
      const ordered = tag === 'OL'
      const style = node.getAttribute('data-style')
      const items: Inline[][] = []
      readListItems(node, items)
      if (items.length) {
        blocks.push({
          type: 'list',
          ordered,
          ...(style &&
            (ordered ? ORDERED_STYLES : BULLET_STYLES).slice(1).includes(style as never) && {
              style: style as ListStyle,
            }),
          items,
        })
      }
    } else if (TAG_MARKS[tag] || tag === 'BR' || tag === 'SPAN') {
      readInlines(node, {}, loose)
    } else {
      // Thẻ bọc khác (blockquote, section...): đọc khối bên trong
      flushLoose()
      readBlocks(node, blocks)
    }
  }
  flushLoose()
}

/** Mục danh sách lồng nhau được làm phẳng thành các mục ngay sau mục cha */
function readListItems(list: Element, items: Inline[][]) {
  for (const li of Array.from(list.children)) {
    if (li.tagName === 'UL' || li.tagName === 'OL') {
      readListItems(li, items)
      continue
    }
    const inlines: Inline[] = []
    const nested: Element[] = []
    for (const child of Array.from(li.childNodes)) {
      if (child instanceof Element && (child.tagName === 'UL' || child.tagName === 'OL')) {
        nested.push(child)
      } else {
        // Nhiều đoạn trong một mục thì nối bằng xuống dòng
        if (child instanceof Element && child.tagName === 'P' && inlines.length) {
          inlines.push({ text: '\n' })
        }
        readInlines(child, {}, inlines)
      }
    }
    const clean = tidy(inlines)
    if (clean.length) items.push(clean)
    for (const list of nested) readListItems(list, items)
  }
}

function readInlines(node: Node, marks: Marks, out: Inline[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    // Khoảng trắng trong HTML (kể cả xuống dòng của mã nguồn) chỉ là một dấu cách
    const text = (node.textContent ?? '').replace(/[ \t\n\r\f]+/g, ' ')
    if (text) out.push({ text, ...marks })
    return
  }
  if (!(node instanceof Element) || DROPPED_TAGS.has(node.tagName)) return
  if (node.tagName === 'BR') {
    out.push({ text: '\n', ...marks })
    return
  }
  const mark = TAG_MARKS[node.tagName]
  const next = mark ? { ...marks, [mark]: true } : marks
  for (const child of Array.from(node.childNodes)) readInlines(child, next, out)
}

const sameMarks = (a: Inline, b: Inline) => MARK_KEYS.every((k) => a[k] === b[k])

/** Bỏ khoảng trắng hai đầu dòng, gộp đoạn chữ cùng định dạng, bỏ đoạn chữ rỗng */
function tidy(inlines: Inline[]): Inline[] {
  const merged: Inline[] = []
  for (const inline of inlines) {
    const last = merged.at(-1)
    if (last && sameMarks(last, inline)) last.text += inline.text
    else merged.push({ ...inline })
  }
  for (const inline of merged) inline.text = inline.text.replace(/ *\n */g, '\n')
  if (merged.length) {
    merged[0].text = merged[0].text.trimStart()
    merged[merged.length - 1].text = merged[merged.length - 1].text.trimEnd()
  }
  const result = merged.filter((i) => i.text)
  return result.every((i) => !i.text.trim()) ? [] : result
}

function pushText(blocks: Block[], block: TextBlock) {
  const inlines = tidy(block.inlines)
  if (inlines.length) blocks.push({ ...block, inlines })
}

const lineText = (inlines: Inline[]) => inlines.map((i) => i.text).join('')

/** Chữ của từng đơn vị đọc (đoạn, tiêu đề, mục danh sách) theo thứ tự hiển thị */
export const blockTexts = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.type === 'list' ? b.items.map(lineText) : [lineText(b.inlines)]))

/** Toàn bộ chữ nhìn thấy (đếm chữ, đếm ký tự) */
export const contentText = (content: string) => blockTexts(parseContent(content)).join('\n\n')

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function serializeInlines(inlines: Inline[]) {
  return inlines
    .map((inline) => {
      let html = escapeHtml(inline.text).replace(/\n/g, '<br>')
      for (const key of [...MARK_KEYS].reverse()) {
        if (inline[key]) html = `<${MARK_TAGS[key]}>${html}</${MARK_TAGS[key]}>`
      }
      return html
    })
    .join('')
}

export function serializeBlocks(blocks: Block[]) {
  return blocks
    .map((b) => {
      if (b.type === 'list') {
        const tag = b.ordered ? 'ol' : 'ul'
        const style = b.style ? ` data-style="${b.style}"` : ''
        const items = b.items.map((i) => `<li><p>${serializeInlines(i)}</p></li>`).join('')
        return `<${tag}${style}>${items}</${tag}>`
      }
      const tag = b.type === 'heading' ? `h${b.level}` : 'p'
      const align = b.align ? ` style="text-align: ${b.align}"` : ''
      return `<${tag}${align}>${serializeInlines(b.inlines)}</${tag}>`
    })
    .join('')
}

/** HTML sạch để lưu: chỉ còn các thẻ/thuộc tính cho phép; rỗng thì trả về '' */
export const normalizeContent = (content: string) => serializeBlocks(parseContent(content))

/** HTML đưa vào trình soạn: văn bản thuần kiểu cũ được đổi sang đoạn văn */
export const toEditorHtml = (content: string) =>
  isRichContent(content) ? content : normalizeContent(content)
