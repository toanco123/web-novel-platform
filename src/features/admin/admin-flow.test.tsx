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

test('khách vào /admin thì chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/admin')
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/login?next=%2Fadmin')
})

test('người thường thấy trang không tồn tại, không có mục Quản trị trong menu', async () => {
  await registerUser()
  const { user } = renderApp('/admin')
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
    .toBe(`/admin/stories?owner=${linh}`)
  expect(await screen.findByRole('link', { name: 'Mùa Hạ Năm Ấy' }, slow)).toBeInTheDocument()
  expect(await screen.findByText('Tác giả: Linh', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Công khai', { selector: '.ant-tag' })).toBeInTheDocument()
})

test('hộp thư và báo lỗi: đánh dấu đã xử lý thì rời khỏi danh sách đang mở', async () => {
  const { sendContactMessage, reportChapter } = await import('@/features/feedback/api')
  await sendContactMessage({
    name: 'Lan',
    email: 'lan@gmail.com',
    topic: 'copyright',
    message: 'Truyện này đăng lại khi chưa xin phép tác giả.',
  })
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await reportChapter({ slug: story.slug, chapter: 1, reason: 'violation', note: 'Nội dung lạ' })
  signInAs('demo')
  const { user } = renderApp('/admin/inbox')

  expect(await screen.findByText('lan@gmail.com', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Bản quyền nội dung')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Đã xử lý' }))
  expect(await screen.findByText('Không còn tin nhắn nào cần xử lý', {}, slow)).toBeInTheDocument()

  const nav = screen.getAllByRole('navigation', { name: 'Quản trị' })[0]
  await user.click(within(nav).getByRole('link', { name: 'Báo lỗi' }))
  expect(await screen.findByText('Nội dung lạ', {}, slow)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Chương 1: Chương thử 1' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Đã sửa' }))
  expect(await screen.findByText('Không có báo lỗi nào đang mở', {}, slow)).toBeInTheDocument()
})

test('khóa người dùng và gỡ truyện trên giao diện; tác giả thấy lý do gỡ', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  signInAs('demo')
  const { router, user } = renderApp('/admin/users?q=linh')

  // Không có nút khóa cho chính mình; khóa Linh sau khi xác nhận
  expect(await screen.findByText('linh@gmail.com', {}, slow)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Khóa' }))
  const popconfirm = (await screen.findByText('Khóa Linh?', {}, slow)).closest('.ant-popover')!
  await user.click(within(popconfirm as HTMLElement).getByRole('button', { name: 'Khóa' }))
  expect(await screen.findByText('Đã khóa', { selector: '.ant-tag' }, slow)).toBeInTheDocument()

  await router.navigate(`/admin/stories?owner=${linh}`)
  await user.click(await screen.findByRole('button', { name: 'Gỡ' }, slow))
  const dialog = await screen.findByRole('dialog', {}, slow)
  const confirm = within(dialog).getByRole('button', { name: 'Gỡ truyện' })
  expect(confirm).toBeDisabled()
  await user.type(within(dialog).getByLabelText('Lý do gỡ'), 'Đạo văn')
  await user.click(confirm)
  expect(await screen.findByText('Bị gỡ', { selector: '.ant-tag' }, slow)).toBeInTheDocument()

  // Mở khóa để Linh vào khu Sáng tác xem lý do
  const { setUserBanned } = await import('./api')
  await setUserBanned(linh, false)
  signInAs(linh)
  await router.navigate(`/studio/story/${story.id}`)
  expect(await screen.findByText(/Truyện đã bị ban quản trị gỡ/, {}, slow)).toBeInTheDocument()
  expect(screen.getByText(/Đạo văn/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xuất bản truyện' })).toBeDisabled()
})
