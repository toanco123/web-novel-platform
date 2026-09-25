import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 4000 }
beforeEach(() => localStorage.clear())
const signIn = () => localStorage.setItem('mock-auth-session', JSON.stringify('demo'))
const content = 'Mùa hạ năm ấy, lớp mười một chuyển chỗ ngồi. '.repeat(5)

test('chưa đăng nhập vào khu Sáng tác thì chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/sang-tac/truyen-moi')
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/dang-nhap?next=%2Fsang-tac%2Ftruyen-moi')
})

test('đăng truyện → viết chương → xuất bản → truyện hiện công khai', async () => {
  signIn()
  const { router, user } = renderApp('/sang-tac/truyen-moi')

  // Form truyện: báo lỗi khi thiếu, rồi điền đủ
  await user.click(await screen.findByRole('button', { name: 'Lưu và thêm chương' }, slow))
  expect(await screen.findByText('Chọn ít nhất 1 thể loại')).toBeInTheDocument()

  await user.type(screen.getByLabelText('Tên truyện'), 'Mùa Hạ Năm Ấy')
  await user.type(
    screen.getByLabelText('Giới thiệu'),
    'Một câu chuyện tình học trò nhẹ nhàng giữa hai người bạn cùng bàn.',
  )
  // Tạo thể loại mới ngay trong ô chọn
  const genres = screen.getByRole('combobox', { name: 'Thể loại (1–5)' })
  await user.type(genres, 'Thanh xuân')
  await user.click(await screen.findByRole('option', { name: 'Tạo thể loại “Thanh xuân”' }))
  expect(
    await screen.findByRole('button', { name: 'Bỏ thể loại Thanh xuân' }, slow),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Lưu và thêm chương' }))

  // Trang quản lý: chưa xuất bản được vì chưa có chương
  expect(await screen.findByRole('heading', { level: 1, name: 'Mùa Hạ Năm Ấy' }, slow))
  expect(screen.getByRole('button', { name: 'Xuất bản truyện' })).toBeDisabled()

  await user.click(screen.getByRole('link', { name: 'Viết chương mới' }))
  await user.type(
    await screen.findByLabelText('Tiêu đề chương (không bắt buộc)', {}, slow),
    'Gặp lại',
  )
  await user.type(screen.getByLabelText('Nội dung'), content)
  await user.click(screen.getByRole('button', { name: 'Xuất bản chương' }))

  const publish = await screen.findByRole('button', { name: 'Xuất bản truyện' }, slow)
  await waitFor(() => expect(publish).toBeEnabled(), slow)
  await user.click(publish)
  expect(await screen.findByText(/Truyện đã công khai/, {}, slow)).toBeInTheDocument()

  // Người đọc thấy truyện ở trang chủ và trang chi tiết
  localStorage.removeItem('mock-auth-session')
  await router.navigate('/')
  const latest = await screen.findByRole('heading', { name: 'Mới cập nhật' }, slow)
  const section = latest.closest('section')!
  expect(
    await within(section).findByRole('link', { name: 'Mùa Hạ Năm Ấy' }, slow),
  ).toBeInTheDocument()
  expect(within(section).getByRole('link', { name: 'Chương 1: Gặp lại' })).toBeInTheDocument()
})

test('rời trình soạn chương khi chưa lưu thì hỏi lại', async () => {
  signIn()
  const { createStory } = await import('./api')
  const story = await createStory({
    title: 'Truyện thử',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  const { router, user } = renderApp(`/sang-tac/truyen/${story.id}/chuong-moi`)
  await user.type(await screen.findByLabelText('Nội dung', {}, slow), 'Đang viết dở…')
  await user.click(screen.getByRole('link', { name: 'Hủy' }))

  const dialog = await screen.findByRole('dialog', {}, slow)
  expect(within(dialog).getByText('Rời trang khi chưa lưu?')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Ở lại viết tiếp' }))
  expect(router.state.location.pathname).toMatch(/chuong-moi$/)

  await user.click(screen.getByRole('link', { name: 'Hủy' }))
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rời trang' }),
  )
  await expect.poll(() => router.state.location.pathname, slow).toBe(`/sang-tac/truyen/${story.id}`)
})

test('nhập file .txt: xem trước rồi thêm chương', async () => {
  signIn()
  const { createStory } = await import('./api')
  const story = await createStory({
    title: 'Truyện nhập file',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  const { user } = renderApp(`/sang-tac/truyen/${story.id}/nhap-file`)
  const file = new File([`Chương 1: Một\n${content}\nChương 2: Hai\n${content}`], 'truyen.txt', {
    type: 'text/plain',
  })
  await user.upload(await screen.findByLabelText(/chọn file \.txt/, {}, slow), file)
  expect(await screen.findByRole('heading', { name: /Xem trước: 2 chương/ }, slow))

  await user.click(screen.getByRole('button', { name: 'Thêm 2 chương' }))
  const list = await screen.findByRole('list', { name: 'Danh sách chương' }, slow)
  expect(within(list).getByText('Một')).toBeInTheDocument()
  expect(within(list).getByText('Hai')).toBeInTheDocument()
})

test('xóa truyện phải gõ đúng tên', async () => {
  signIn()
  const { createStory } = await import('./api')
  const story = await createStory({
    title: 'Truyện sẽ xóa',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  const { router, user } = renderApp(`/sang-tac/truyen/${story.id}`)
  await user.click(await screen.findByRole('button', { name: 'Xóa truyện' }, slow))
  const dialog = await screen.findByRole('dialog')
  const confirm = within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' })
  expect(confirm).toBeDisabled()
  await user.type(within(dialog).getByLabelText(/để xác nhận/), 'Truyện sẽ xóa')
  await user.click(confirm)
  await expect.poll(() => router.state.location.pathname, slow).toBe('/sang-tac')
  expect(await screen.findByText('Bạn chưa đăng truyện nào', {}, slow)).toBeInTheDocument()
})

test('trang thể loại có sẵn: nút đăng truyện mở form với thể loại được chọn sẵn', async () => {
  signIn()
  const { router, user } = renderApp('/the-loai/ngon-tinh')
  await user.click(await screen.findByRole('link', { name: 'Đăng truyện Ngôn tình' }, slow))
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/sang-tac/truyen-moi?the-loai=ngon-tinh')
  expect(
    await screen.findByRole('button', { name: 'Bỏ thể loại Ngôn tình' }, slow),
  ).toBeInTheDocument()
})

test('?the-loai không có thật thì bỏ qua, form để trống thể loại', async () => {
  signIn()
  renderApp('/sang-tac/truyen-moi?the-loai=khong-co-that')
  expect(await screen.findByLabelText('Tên truyện', {}, slow)).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Thể loại đã chọn' })).not.toBeInTheDocument()
})
