import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }
beforeEach(() => localStorage.clear())
// Nút được thay bằng phần tử khác khi phiên tải xong, nên luôn tìm lại
const enabledCreateButton = () =>
  waitFor(() => {
    const button = screen.getByRole('button', { name: 'Tạo thể loại' })
    expect(button).toBeEnabled()
    return button
  }, slow)
const signIn = () => localStorage.setItem('mock-auth-session', JSON.stringify('demo'))

test('chưa đăng nhập bấm "Tạo thể loại" thì sang trang đăng nhập', async () => {
  const { router, user } = renderApp('/the-loai')
  await user.click(await enabledCreateButton())
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/dang-nhap?next=%2Fthe-loai')
})

test('tạo thể loại trong hộp thoại: trùng thì báo, mới thì chuyển tới trang thể loại', async () => {
  signIn()
  const { router, user } = renderApp('/the-loai')
  await user.click(await enabledCreateButton())
  const dialog = await screen.findByRole('dialog')

  await user.type(within(dialog).getByLabelText('Tên thể loại'), 'ngon tinh')
  await user.click(within(dialog).getByRole('button', { name: 'Tạo thể loại' }))
  expect(await within(dialog).findByRole('alert', {}, slow)).toHaveTextContent(
    'Thể loại Ngôn tình đã có.',
  )

  const name = within(dialog).getByLabelText('Tên thể loại')
  await user.clear(name)
  await user.type(name, 'Hệ thống')
  await user.click(within(dialog).getByRole('button', { name: 'Tạo thể loại' }))

  await expect.poll(() => router.state.location.pathname, slow).toBe('/the-loai/he-thong')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Hệ thống' }, slow),
  ).toBeInTheDocument()
  expect(
    await screen.findByText('Chưa có truyện nào thuộc thể loại này.', {}, slow),
  ).toBeInTheDocument()
})

test('lọc không thấy thì gợi ý tạo đúng tên vừa gõ', async () => {
  signIn()
  const { user } = renderApp('/the-loai')
  await user.type(await screen.findByLabelText('Tìm thể loại', {}, slow), 'Xuyên nhanh')
  await user.click(await screen.findByRole('button', { name: 'Tạo thể loại “Xuyên nhanh”' }))
  expect(within(await screen.findByRole('dialog')).getByLabelText('Tên thể loại')).toHaveValue(
    'Xuyên nhanh',
  )
})
