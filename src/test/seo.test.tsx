// Thẻ SEO trong <head>: React 19 đưa <title>, <meta>, <link> render trong trang lên head
import { screen, waitFor } from '@testing-library/react'
import { SITE_NAME } from '@/config/site'
import { SITE_URL } from '@/lib/siteUrl'
import { signInAs } from '@/test/helpers'
import { renderApp } from './renderApp'

// G2 vẽ bằng canvas, jsdom không có: thay biểu đồ của trang quản trị bằng thẻ rỗng
vi.mock('@ant-design/plots', () => {
  const Stub = () => <div data-testid="chart" />
  return { Column: Stub, Line: Stub, Bar: Stub }
})

const slow = { timeout: 3000 }
const head = (selector: string) => document.head.querySelector(selector)
const content = (selector: string) => head(selector)?.getAttribute('content')

beforeEach(() => localStorage.clear())

test('trang truyện: canonical bỏ query, Open Graph theo truyện', async () => {
  renderApp('/story/truong-an-khong-tuyet?page=2')
  await waitFor(
    () =>
      expect(head('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE_URL}/story/truong-an-khong-tuyet`,
      ),
    slow,
  )
  expect(document.title).toBe(`Trường An Không Tuyết - Diệp Thanh Y | ${SITE_NAME}`)
  expect(content('meta[property="og:title"]')).toBe('Trường An Không Tuyết - Diệp Thanh Y')
  expect(content('meta[property="og:type"]')).toBe('book')
  expect(content('meta[property="og:url"]')).toBe(`${SITE_URL}/story/truong-an-khong-tuyet`)
  expect(content('meta[property="og:image"]')).toBe(`${SITE_URL}/og-default.png`)
  expect(content('meta[name="description"]')).toBe(content('meta[property="og:description"]'))
  expect(head('meta[name="robots"]')).toBeNull()
})

test('trang chương: canonical của chương, og:type article', async () => {
  renderApp('/story/truong-an-khong-tuyet/chapter-2')
  await waitFor(
    () =>
      expect(head('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE_URL}/story/truong-an-khong-tuyet/chapter-2`,
      ),
    slow,
  )
  expect(content('meta[property="og:type"]')).toBe('article')
  expect(document.title).toMatch(/^Chương 2: .+ - Trường An Không Tuyết \| /)
})

test('chuyển trang thì thẻ đổi theo trang mới, không để lại thẻ của trang cũ', async () => {
  const { router } = renderApp('/genres/co-dai')
  await waitFor(
    () =>
      expect(head('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/genres/co-dai`),
    slow,
  )
  await router.navigate('/')
  await waitFor(
    () => expect(head('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/`),
    slow,
  )
  expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
})

test.each([
  ['/search?q=hoa', 'Tìm truyện'],
  ['/login', 'Đăng nhập'],
  ['/khong-co-trang-nay', 'Trang bạn tìm không tồn tại.'],
  ['/story/khong-co-truyen-nay', /Không tìm thấy truyện này/],
])('%s không cho lập chỉ mục', async (path, text) => {
  renderApp(path)
  await screen.findAllByText(text, {}, slow)
  await waitFor(() => expect(content('meta[name="robots"]')).toBe('noindex'), slow)
  expect(head('link[rel="canonical"]')).toBeNull()
  expect(head('meta[property="og:title"]')).toBeNull()
})

test.each([
  ['/library', 'Tủ truyện'],
  ['/account', 'Tài khoản'],
  ['/studio', 'Sáng tác của bạn'],
  ['/admin', 'Tổng quan'],
])('trang riêng tư %s không cho lập chỉ mục', async (path, heading) => {
  signInAs('demo')
  renderApp(path)
  await screen.findByRole('heading', { name: heading }, slow)
  expect(content('meta[name="robots"]')).toBe('noindex')
  expect(head('link[rel="canonical"]')).toBeNull()
})

test('trang thông tin: canonical là đường dẫn chuẩn dù URL có dấu / ở cuối', async () => {
  renderApp('/about/')
  await screen.findByRole('heading', { level: 1, name: `Về ${SITE_NAME}` }, slow)
  expect(head('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/about`)
  expect(content('meta[name="description"]')).toBe(
    'Nơi đọc và đăng truyện chữ tiếng Việt, gọn nhẹ và dễ chịu cho mắt.',
  )
})
