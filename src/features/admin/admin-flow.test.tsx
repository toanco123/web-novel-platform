import { screen, within } from '@testing-library/react'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'

// G2 vẽ bằng canvas, jsdom không có: thay biểu đồ bằng thẻ rỗng
vi.mock('@ant-design/plots', () => {
  const Stub = () => <div data-testid="chart" />
  return { Column: Stub, Line: Stub, Bar: Stub }
})

const slow = { timeout: 4000 }
beforeEach(() => localStorage.clear())

test('khách vào /quan-tri thì chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/quan-tri')
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/dang-nhap?next=%2Fquan-tri')
})

test('người thường thấy trang không tồn tại, không có mục Quản trị trong menu', async () => {
  await registerUser()
  const { user } = renderApp('/quan-tri')
  expect(await screen.findByText('Trang bạn tìm không tồn tại.', {}, slow)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'Về trang chủ' }))
  await user.click(await screen.findByRole('button', { name: /Tài khoản của Linh/ }, slow))
  expect(await screen.findByRole('menuitem', { name: 'Tủ truyện' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Quản trị' })).not.toBeInTheDocument()
})

test('quản trị viên xem tổng quan, người dùng và truyện của một tác giả', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  await publishStory('Mùa Hạ Năm Ấy', 2)
  signInAs('demo')
  const { router, user } = renderApp('/')

  // Menu tài khoản có lối vào trang quản trị
  await user.click(await screen.findByRole('button', { name: /Tài khoản của Bạn đọc Demo/ }, slow))
  await user.click(await screen.findByRole('menuitem', { name: 'Quản trị' }))
  expect(await screen.findByRole('heading', { name: 'Tổng quan' }, slow)).toBeInTheDocument()
  expect(await screen.findByText('Người dùng', { selector: '.ant-statistic-title' }, slow))
  expect(screen.getByText('+1 trong kỳ')).toBeInTheDocument()

  // Xem dạng bảng của biểu đồ truyện theo thể loại
  const genreCard = screen.getByText('Truyện công khai theo thể loại').closest('.ant-card')!
  await user.click(within(genreCard as HTMLElement).getByText('Bảng'))
  expect(
    within(genreCard as HTMLElement).getByRole('columnheader', { name: 'Số truyện' }),
  ).toBeInTheDocument()

  // Người dùng: tìm theo tên không dấu
  const nav = screen.getAllByRole('navigation', { name: 'Quản trị' })[0]
  await user.click(within(nav).getByRole('link', { name: 'Người dùng' }))
  expect(await screen.findByRole('heading', { name: 'Người dùng' }, slow)).toBeInTheDocument()
  expect(await screen.findByText('linh@gmail.com', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('demo@webtruyen.vn')).toBeInTheDocument()
  await user.type(screen.getByRole('searchbox', { name: 'Tìm người dùng' }), 'linh{Enter}')
  await expect.poll(() => router.state.location.search, slow).toBe('?q=linh')
  await expect.poll(() => screen.queryByText('demo@webtruyen.vn'), slow).toBeNull()

  // Bấm số truyện → danh sách truyện của Linh
  await user.click(screen.getByRole('link', { name: '1 truyện của Linh' }))
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe(`/quan-tri/truyen?tac-gia=${linh}`)
  expect(await screen.findByRole('link', { name: 'Mùa Hạ Năm Ấy' }, slow)).toBeInTheDocument()
  expect(await screen.findByText('Tác giả: Linh', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Công khai', { selector: '.ant-tag' })).toBeInTheDocument()
})
