import { cleanup, screen, waitFor } from '@testing-library/react'
import { SITE_NAME } from '@/config/site'
import { paths } from '@/lib/routes'
import { signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'
import { useAppBannerStore } from './useAppBanner'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
const APP_STORE = 'https://apps.apple.com/app/id1234567890'
const PLAY = 'https://play.google.com/store/apps/details?id=com.webtruyen.app'
const DAY = 24 * 60 * 60 * 1000
const region = { name: 'Giới thiệu app di động' }
const slow = { timeout: 3000 }

const onDevice = (ua: string) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
const findBanner = () => screen.findByRole('region', region, slow)
const bannerHeight = () => document.documentElement.style.getPropertyValue('--app-banner-h')
const footer = () => screen.findByRole('contentinfo', undefined, slow)

/** Đợi trang tải xong (ready) rồi mới khẳng định không có banner */
async function expectNoBanner(ready: () => Promise<unknown>) {
  await ready()
  expect(screen.queryByRole('region', region)).toBeNull()
}

beforeEach(() => {
  useAppBannerStore.setState({ dismissedAt: null, dismissedThisSession: false })
  vi.stubEnv('VITE_APP_STORE_URL', APP_STORE)
  vi.stubEnv('VITE_PLAY_STORE_URL', PLAY)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test('iPhone: banner mời tải app trỏ App Store', async () => {
  onDevice(IPHONE)
  renderApp(paths.home)
  expect(await findBanner()).toHaveTextContent(`App ${SITE_NAME}`)
  expect(screen.getByRole('link', { name: 'Tải app' })).toHaveAttribute('href', APP_STORE)
})

test('Android: trỏ Google Play', async () => {
  onDevice(ANDROID)
  renderApp(paths.home)
  await findBanner()
  expect(screen.getByRole('link', { name: 'Tải app' })).toHaveAttribute('href', PLAY)
})

test('nền tảng chưa có link store thì không có banner', async () => {
  onDevice(IPHONE)
  vi.stubEnv('VITE_APP_STORE_URL', '')
  renderApp(paths.home)
  await expectNoBanner(footer)
})

test('máy tính không có banner', async () => {
  renderApp(paths.home)
  await expectNoBanner(footer)
})

test('trang đọc chương không có banner', async () => {
  onDevice(IPHONE)
  renderApp(paths.chapter('truong-an-khong-tuyet', 2))
  await expectNoBanner(() =>
    waitFor(() => expect(document.querySelector('[data-chapter]')).not.toBeNull(), slow),
  )
})

test('trang đăng nhập không có banner', async () => {
  onDevice(IPHONE)
  renderApp(paths.login())
  await expectNoBanner(() => screen.findByRole('heading', { name: /Đăng nhập/ }, slow))
})

test('chuyển sang khu Sáng tác thì banner biến mất', async () => {
  onDevice(IPHONE)
  signInAs('demo')
  const { router } = renderApp(paths.home)
  await findBanner()
  await router.navigate(paths.studio)
  await waitFor(() => expect(screen.queryByRole('region', region)).toBeNull())
})

test('bấm ✕ thì ẩn và nhớ; toast hết bị đẩy lên', async () => {
  onDevice(IPHONE)
  const { user } = renderApp(paths.home)
  await findBanner()
  expect(bannerHeight()).not.toBe('')

  await user.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(screen.queryByRole('region', region)).toBeNull()
  expect(bannerHeight()).toBe('')
  const saved = JSON.parse(localStorage.getItem('app-banner')!)
  expect(saved.state.dismissedAt).toEqual(expect.any(Number))
})

test('tắt từ 30 ngày trước thì hiện lại, chưa tới 30 ngày thì vẫn ẩn', async () => {
  onDevice(IPHONE)
  useAppBannerStore.setState({ dismissedAt: Date.now() - 29 * DAY })
  renderApp(paths.home)
  await expectNoBanner(footer)
  cleanup()

  useAppBannerStore.setState({ dismissedAt: Date.now() - 31 * DAY })
  renderApp(paths.home)
  await findBanner()
})

test('bấm "Tải app" cũng tính là đã tắt', async () => {
  onDevice(ANDROID)
  const { user } = renderApp(paths.home)
  await findBanner()
  await user.click(screen.getByRole('link', { name: 'Tải app' }))
  expect(screen.queryByRole('region', region)).toBeNull()
})

test('dữ liệu app-banner hỏng thì vẫn hiện banner', async () => {
  onDevice(IPHONE)
  useAppBannerStore.setState({ dismissedAt: 'hỏng' as unknown as number })
  renderApp(paths.home)
  await findBanner()
})
