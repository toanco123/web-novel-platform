import { describe, expect, it } from 'vitest'
import {
  blockTexts,
  contentText,
  isRichContent,
  normalizeContent,
  parseContent,
  toEditorHtml,
} from './richText'

describe('parseContent', () => {
  it('đọc văn bản thuần kiểu cũ: đoạn cách nhau bằng dòng trống', () => {
    expect(parseContent('Đoạn một\ndòng hai\n\n\n  Đoạn hai  ')).toEqual([
      { type: 'paragraph', inlines: [{ text: 'Đoạn một\ndòng hai' }] },
      { type: 'paragraph', inlines: [{ text: 'Đoạn hai' }] },
    ])
  })

  it('văn bản thuần có ký tự < vẫn là văn bản thuần', () => {
    expect(isRichContent('<3 em nhé\n\nHết')).toBe(false)
    expect(parseContent('a < b')).toEqual([{ type: 'paragraph', inlines: [{ text: 'a < b' }] }])
  })

  it('đọc HTML: đoạn, tiêu đề, căn giữa, chữ đậm/nghiêng/gạch, xuống dòng', () => {
    const html =
      '<h2>Mở đầu</h2><p style="text-align: center;">***</p>' +
      '<p>Chữ <strong>đậm <em>nghiêng</em></strong> và <u>gạch</u> <s>bỏ</s><br>dòng mới</p>' +
      '<h3 style="text-align: center">Nhỏ</h3>'
    expect(parseContent(html)).toEqual([
      { type: 'heading', level: 2, inlines: [{ text: 'Mở đầu' }] },
      { type: 'paragraph', align: 'center', inlines: [{ text: '***' }] },
      {
        type: 'paragraph',
        inlines: [
          { text: 'Chữ ' },
          { text: 'đậm ', bold: true },
          { text: 'nghiêng', bold: true, italic: true },
          { text: ' và ' },
          { text: 'gạch', underline: true },
          { text: ' ' },
          { text: 'bỏ', strike: true },
          { text: '\ndòng mới' },
        ],
      },
      { type: 'heading', level: 3, align: 'center', inlines: [{ text: 'Nhỏ' }] },
    ])
  })

  it('đọc danh sách, giữ kiểu danh sách hợp lệ và làm phẳng danh sách lồng', () => {
    const html =
      '<ul data-style="square"><li><p>Một</p></li><li><p>Hai</p><ul><li><p>Hai.1</p></li></ul></li></ul>' +
      '<ol data-style="lower-roman"><li><p><strong>A</strong></p></li></ol>' +
      '<ol data-style="bogus"><li>B</li></ol>'
    expect(parseContent(html)).toEqual([
      {
        type: 'list',
        ordered: false,
        style: 'square',
        items: [[{ text: 'Một' }], [{ text: 'Hai' }], [{ text: 'Hai.1' }]],
      },
      { type: 'list', ordered: true, style: 'lower-roman', items: [[{ text: 'A', bold: true }]] },
      { type: 'list', ordered: true, items: [[{ text: 'B' }]] },
    ])
  })

  it('bỏ đoạn và mục danh sách rỗng', () => {
    expect(parseContent('<p></p><p>  </p><p>Có chữ</p><ul><li><p></p></li></ul>')).toEqual([
      { type: 'paragraph', inlines: [{ text: 'Có chữ' }] },
    ])
  })

  it('không giữ thẻ hay thuộc tính nguy hiểm', () => {
    const html =
      '<p onclick="alert(1)" style="color:red">Chào<script>alert(1)</script>' +
      '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">link</a><style>p{}</style></p>'
    expect(parseContent(html)).toEqual([{ type: 'paragraph', inlines: [{ text: 'Chàolink' }] }])
    const out = normalizeContent(html)
    expect(out).toBe('<p>Chàolink</p>')
  })

  it('escape ký tự đặc biệt khi dựng lại HTML', () => {
    expect(normalizeContent('<p>a &lt;b&gt; &amp; "c"</p>')).toBe(
      '<p>a &lt;b&gt; &amp; &quot;c&quot;</p>',
    )
  })
})

describe('normalizeContent', () => {
  it('ổn định: chuẩn hóa hai lần như một', () => {
    const html =
      '<h2 style="text-align: center;">T</h2><p><b>x</b><i>y</i> <del>z</del></p>' +
      '<ol data-style="upper-roman"><li><p>1</p></li></ol><ul><li><p>2</p></li></ul>'
    const once = normalizeContent(html)
    expect(once).toBe(
      '<h2 style="text-align: center">T</h2><p><strong>x</strong><em>y</em> <s>z</s></p>' +
        '<ol data-style="upper-roman"><li><p>1</p></li></ol><ul><li><p>2</p></li></ul>',
    )
    expect(normalizeContent(once)).toBe(once)
  })

  it('nội dung rỗng cho ra chuỗi rỗng', () => {
    expect(normalizeContent('')).toBe('')
    expect(normalizeContent('<p></p>')).toBe('')
  })
})

describe('chữ nhìn thấy', () => {
  it('contentText bỏ định dạng, blockTexts tách từng đoạn/tiêu đề/mục danh sách', () => {
    const html =
      '<h2>Tựa</h2><p><strong>Đậm</strong> thường</p><ul><li><p>a</p></li><li><p>b</p></li></ul>'
    expect(blockTexts(parseContent(html))).toEqual(['Tựa', 'Đậm thường', 'a', 'b'])
    expect(contentText(html)).toBe('Tựa\n\nĐậm thường\n\na\n\nb')
    expect(contentText('Một\n\nHai')).toBe('Một\n\nHai')
  })
})

describe('toEditorHtml', () => {
  it('chuyển văn bản thuần sang đoạn văn, giữ nguyên HTML', () => {
    expect(toEditorHtml('Một\ndòng\n\n<Hai>')).toBe('<p>Một<br>dòng</p><p>&lt;Hai&gt;</p>')
    expect(toEditorHtml('<p>x</p>')).toBe('<p>x</p>')
    expect(toEditorHtml('')).toBe('')
  })
})
