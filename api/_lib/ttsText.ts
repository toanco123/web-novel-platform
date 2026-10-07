// Cắt chữ của một đoạn thành các phần gửi Google và đặt tên file trên R2 cho từng phần.
// Plan: documents/plan-giong-ai.md
import { createHash } from 'node:crypto'
import { splitForSpeech } from '../../src/features/reader/speech/splitForSpeech.js'

/** Google nhận tối đa 5.000 byte mỗi lần; tiếng Việt có dấu tốn 2–3 byte mỗi chữ nên chừa rộng */
export const TTS_PART_MAX_BYTES = 1400
/** Đổi khi đổi cách tạo âm thanh (định dạng, cách cắt) để không dùng lại file cũ */
const KEY_VERSION = 'v1'

const byteLength = (text: string) => Buffer.byteLength(text, 'utf8')

/**
 * Các phần cần đọc của một đoạn, mỗi phần ≤ TTS_PART_MAX_BYTES. Đoạn không có chữ hay số (`***`,
 * `—`) trả mảng rỗng: Google báo lỗi hoặc đọc ra im lặng.
 */
export function ttsParts(text: string, maxBytes = TTS_PART_MAX_BYTES): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!/[\p{L}\p{N}]/u.test(clean)) return []
  const parts: string[] = []
  let current = ''
  // Câu ngắn (≤ 400 ký tự ≈ ≤ 1.200 byte) rồi gom lại tới sát giới hạn
  for (const sentence of splitForSpeech(clean, 400)) {
    const joined = current ? `${current} ${sentence}` : sentence
    if (current && byteLength(joined) > maxBytes) {
      parts.push(current)
      current = sentence
    } else {
      current = joined
    }
  }
  if (current) parts.push(current)
  return parts
}

/** Hash nội dung của một phần (cùng giọng + cùng chữ thì dùng chung file) */
export const clipHash = (voice: string, text: string) =>
  createHash('sha256').update(`${KEY_VERSION}|mp3|${voice}|${text}`).digest('hex')

export const clipKey = (voice: string, hash: string) => `tts/${KEY_VERSION}/${voice}/${hash}.mp3`

/** Số ký tự Google tính tiền (đếm theo code point, kể cả khoảng trắng) */
export const countChars = (text: string) => [...text].length
