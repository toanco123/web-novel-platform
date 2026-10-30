import { screen, within } from '@testing-library/react'
import { addComment } from '@/features/comments/api'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }

/** jsdom không có màn rộng: giả `min-width` khớp để chuông mở popover thay vì là link */
function wideScreen() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('min-width'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
}

afterEach(() => vi.restoreAllMocks())

beforeEach(() => localStorage.clear())

/** Chủ truyện (đang đăng nhập) có hai thông báo bình luận chưa đọc */
async function ownerWithNotifications() {
  const owner = await registerUser('Chủ', 'chu@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await registerUser('Linh', 'linh@gmail.com')
  await addComment(story.slug, 'Truyện hay quá')
  signInAs(owner)
  return story
}

test('khách không thấy chuông; trang thông báo chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/')
  await screen.findByRole('link', { name: 'Đăng nhập' }, slow)
  expect(screen.queryByRole('button', { name: /^Thông báo/ })).not.toBeInTheDocument()
  await router.navigate('/notifications')
  await expect.poll(() => router.state.location.pathname, slow).toBe('/login')
})

test('màn hẹp: chuông là link sang trang thông báo', async () => {
  await ownerWithNotifications()
  const { user, router } = renderApp('/')
  await user.click(await screen.findByRole('link', { name: /^Thông báo \(2 chưa đọc\)/ }, slow))
  await expect.poll(() => router.state.location.pathname, slow).toBe('/notifications')
})

test('chuông hiện số chưa đọc, mở ra thấy thông báo, bấm thì sang truyện và đã đọc', async () => {
  wideScreen()
  const story = await ownerWithNotifications()
  const { user, router } = renderApp('/')

  const bell = await screen.findByRole('button', { name: /^Thông báo \(2 chưa đọc\)/ }, slow)
  await user.click(bell)
  const link = await screen.findByRole('link', { name: /Linh bình luận trong/ }, slow)
  expect(link).toHaveTextContent('Truyện hay quá')
  await user.click(link)
  await expect.poll(() => router.state.location.pathname, slow).toBe(`/story/${story.slug}`)
  expect(
    await screen.findByRole('button', { name: /^Thông báo \(1 chưa đọc\)/ }, slow),
  ).toBeInTheDocument()
})

test('trang thông báo: đọc hết, xóa từng dòng, trạng thái trống', async () => {
  await ownerWithNotifications()
  const { user } = renderApp('/notifications')

  const section = await screen.findByRole('region', { name: 'Danh sách thông báo' }, slow)
  expect(await within(section).findByText(/Linh bình luận trong/, {}, slow)).toBeInTheDocument()
  expect(within(section).getAllByRole('img', { name: 'Chưa đọc' })).toHaveLength(2)

  await user.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }))
  await expect
    .poll(() => within(section).queryAllByRole('img', { name: 'Chưa đọc' }).length, slow)
    .toBe(0)
  expect(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeDisabled()

  for (const del of within(section).getAllByRole('button', { name: /^Xóa thông báo/ })) {
    await user.click(del)
  }
  expect(await within(section).findByText('Chưa có thông báo nào.', {}, slow)).toBeInTheDocument()
})
