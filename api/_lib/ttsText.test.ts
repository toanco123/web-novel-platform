import { describe, expect, test } from 'vitest'
import { clipHash, clipKey, countChars, TTS_PART_MAX_BYTES, ttsParts } from './ttsText.js'

describe('ttsParts', () => {
  test('đoạn ngắn là một phần, khoảng trắng được gom', () => {
    expect(ttsParts('  Trời   đã sáng.\n Hắn bước ra. ')).toEqual(['Trời đã sáng. Hắn bước ra.'])
  })

  test('đoạn không có chữ hay số thì không đọc', () => {
    expect(ttsParts('***')).toEqual([])
    expect(ttsParts(' — … ')).toEqual([])
    expect(ttsParts('')).toEqual([])
  })

  test('đoạn dài cắt thành nhiều phần, mỗi phần trong giới hạn byte, không mất chữ', () => {
    const sentence = 'Những ngọn đèn lồng đỏ rực treo dọc theo bờ sông, gió thổi lay động. '
    const text = sentence.repeat(60).trim()
    const parts = ttsParts(text)
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts)
      expect(Buffer.byteLength(part)).toBeLessThanOrEqual(TTS_PART_MAX_BYTES)
    expect(parts.join(' ')).toBe(text)
  })
})

describe('khóa file', () => {
  test('cùng giọng + cùng chữ thì cùng hash; khác giọng hoặc chữ thì khác', () => {
    const a = clipHash('Aoede', 'Xin chào.')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(clipHash('Aoede', 'Xin chào.')).toBe(a)
    expect(clipHash('Kore', 'Xin chào.')).not.toBe(a)
    expect(clipHash('Aoede', 'Xin chào!')).not.toBe(a)
    expect(clipKey('Aoede', a)).toBe(`tts/v1/Aoede/${a}.mp3`)
  })

  test('đếm ký tự theo code point', () => {
    expect(countChars('Đường xa')).toBe(8)
  })
})
