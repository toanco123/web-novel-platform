import { storeUrl } from './mobileApp'

afterEach(() => vi.unstubAllEnvs())

test('chưa khai báo hoặc khai báo sai thì không có link', () => {
  for (const value of ['', '   ', 'apps.apple.com/app/id1', 'http://apps.apple.com/app/id1']) {
    vi.stubEnv('VITE_APP_STORE_URL', value)
    expect(storeUrl('ios')).toBeNull()
  }
})

test('mỗi nền tảng lấy đúng link của mình, bỏ khoảng trắng thừa', () => {
  vi.stubEnv('VITE_APP_STORE_URL', ' https://apps.apple.com/app/id1234567890 ')
  vi.stubEnv(
    'VITE_PLAY_STORE_URL',
    'https://play.google.com/store/apps/details?id=com.webtruyen.app',
  )
  expect(storeUrl('ios')).toBe('https://apps.apple.com/app/id1234567890')
  expect(storeUrl('android')).toBe(
    'https://play.google.com/store/apps/details?id=com.webtruyen.app',
  )
})
