import { mobilePlatform } from './platform'

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ mặc định mở web ở chế độ máy tính: UA giống hệt Safari trên Mac
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

test.each([
  ['iPhone', UA.iphone, 5, 'ios'],
  ['iPad báo là Mac (có màn cảm ứng)', UA.mac, 5, 'ios'],
  ['Mac thật', UA.mac, 0, null],
  ['Android', UA.android, 5, 'android'],
  ['máy tính Windows', UA.windows, 0, null],
])('%s', (_, ua, touch, expected) => {
  expect(mobilePlatform(ua, touch)).toBe(expected)
})
