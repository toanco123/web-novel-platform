import { describe, expect, test } from 'vitest'
import { voiceTips } from './voiceTips'

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0',
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  chromeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
}

describe('voiceTips', () => {
  test('iPhone và app iOS: tải giọng Linh nâng cao', () => {
    expect(voiceTips(UA.iphone)).toEqual([expect.stringContaining('Linh (Nâng cao)')])
    expect(voiceTips('ios')).toEqual(voiceTips(UA.iphone))
  })

  test('Android: tải dữ liệu giọng tiếng Việt', () => {
    expect(voiceTips(UA.android)).toEqual([expect.stringContaining('Chuyển văn bản sang lời nói')])
    expect(voiceTips('android')).toEqual(voiceTips(UA.android))
  })

  test('Edge: chọn HoaiMy / NamMinh', () => {
    expect(voiceTips(UA.edge)).toEqual([expect.stringContaining('HoaiMy')])
  })

  test('trình duyệt khác trên máy tính: mời dùng Edge; Mac có thêm cách tải giọng Linh', () => {
    expect(voiceTips(UA.chromeWin)).toEqual([expect.stringContaining('Microsoft Edge')])
    expect(voiceTips(UA.chromeMac)).toHaveLength(2)
  })
})
