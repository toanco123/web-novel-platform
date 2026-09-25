import { CONTENT_MAX, CONTENT_MIN } from './schemas'

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024

export type ParsedChapter = {
  /** Số chương ghi trong file (chỉ để kiểm tra; khi lưu sẽ đánh số tiếp nối) */
  sourceNumber: number | null
  title: string
  content: string
  /** Lý do chương này không nhập được (quá ngắn/dài) */
  problem: string | null
}

export type ParseResult = {
  chapters: ParsedChapter[]
  warnings: string[]
}

// "Chương 12: Tiêu đề", "CHƯƠNG 12 - Tiêu đề", "Chuong 12. Tiêu đề", "Chương 12"
const HEADING = /^\s*(?:chương|chuong)\s+(\d{1,5})\s*(?:[:.\-–—]\s*)?(.*?)\s*$/iu

const number = new Intl.NumberFormat('vi-VN')

function tidy(text: string) {
  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function problemOf(content: string) {
  if (content.length < CONTENT_MIN)
    return `Quá ngắn (${content.length} ký tự, cần ít nhất ${CONTENT_MIN})`
  if (content.length > CONTENT_MAX)
    return `Quá dài (${number.format(content.length)} ký tự, tối đa ${number.format(CONTENT_MAX)})`
  return null
}

/** Tách nội dung file .txt thành các chương theo dòng tiêu đề "Chương N" */
export function parseChapters(raw: string): ParseResult {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const warnings: string[] = []
  const headings: { line: number; sourceNumber: number; title: string }[] = []

  lines.forEach((line, i) => {
    const m = line.length <= 150 ? HEADING.exec(line) : null
    if (m) headings.push({ line: i, sourceNumber: Number(m[1]), title: m[2] })
  })

  if (headings.length === 0) {
    const content = tidy(text)
    warnings.push(
      'Không tìm thấy dòng tiêu đề nào dạng "Chương 1: …". Toàn bộ file sẽ thành 1 chương.',
    )
    return {
      chapters: content
        ? [{ sourceNumber: null, title: '', content, problem: problemOf(content) }]
        : [],
      warnings,
    }
  }

  const preface = tidy(lines.slice(0, headings[0].line).join('\n'))
  if (preface) {
    warnings.push(
      `Có ${number.format(preface.length)} ký tự trước chương đầu tiên (lời mở đầu, giới thiệu…). Phần này sẽ bị bỏ qua.`,
    )
  }

  const chapters = headings.map((h, i) => {
    const end = headings[i + 1]?.line ?? lines.length
    const content = tidy(lines.slice(h.line + 1, end).join('\n'))
    return { sourceNumber: h.sourceNumber, title: h.title, content, problem: problemOf(content) }
  })

  const seen = new Set<number>()
  const duplicates = new Set<number>()
  const gaps: string[] = []
  chapters.forEach((c, i) => {
    if (seen.has(c.sourceNumber!)) duplicates.add(c.sourceNumber!)
    seen.add(c.sourceNumber!)
    const prev = chapters[i - 1]?.sourceNumber
    if (prev != null && c.sourceNumber !== prev + 1 && !duplicates.has(c.sourceNumber!)) {
      gaps.push(`${prev} → ${c.sourceNumber}`)
    }
  })
  if (duplicates.size) {
    warnings.push(
      `Số chương bị lặp trong file: ${[...duplicates].join(', ')}. Kiểm tra lại file nhé.`,
    )
  }
  if (gaps.length) {
    warnings.push(
      `Số chương trong file không liền mạch (${gaps.slice(0, 5).join('; ')}${gaps.length > 5 ? '; …' : ''}).`,
    )
  }
  const bad = chapters.filter((c) => c.problem).length
  if (bad) warnings.push(`${bad} chương quá ngắn hoặc quá dài, cần sửa trong file trước khi nhập.`)

  return { chapters, warnings }
}

/** Đọc file người dùng chọn; báo lỗi rõ ràng nếu sai loại, quá lớn hoặc không phải UTF-8 */
export async function readChapterFile(file: File): Promise<string> {
  if (!/\.txt$/i.test(file.name)) throw new Error('Chỉ nhận file .txt.')
  if (file.size > IMPORT_MAX_BYTES)
    throw new Error('File tối đa 2 MB. Tách thành nhiều file nhỏ hơn nhé.')
  const text = await file.text()
  if (text.includes('�')) {
    throw new Error(
      'File không phải mã UTF-8. Mở file bằng Notepad → Lưu thành → chọn mã hóa UTF-8 rồi thử lại.',
    )
  }
  return text
}
