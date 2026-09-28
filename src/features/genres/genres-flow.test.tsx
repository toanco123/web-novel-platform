import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'
import { createGenre } from './api'

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
  const { router, user } = renderApp('/genres')
  await user.click(await enabledCreateButton())
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/login?next=%2Fgenres')
})

test('tạo thể loại trong hộp thoại: trùng thì báo, mới thì chuyển tới trang thể loại', async () => {
  signIn()
  const { router, user } = renderApp('/genres')
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

  await expect.poll(() => router.state.location.pathname, slow).toBe('/genres/he-thong')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Hệ thống' }, slow),
  ).toBeInTheDocument()
  expect(
    await screen.findByText('Chưa có truyện nào thuộc thể loại này.', {}, slow),
  ).toBeInTheDocument()
})

test('ô chọn: tạo trùng thể loại người khác vừa tạo thì chọn nó, với tên đúng', async () => {
  signIn()
  const { user } = renderApp('/studio/new-story')
  const picker = await screen.findByRole('combobox', { name: 'Thể loại (1–5)' }, slow)
  await user.click(picker)
  await screen.findByRole('listbox', { name: 'Gợi ý thể loại' }, slow)
  // Có người tạo sau khi danh sách đã tải: danh sách trên trang chưa có "Hệ thống"
  await createGenre({ name: 'Hệ thống' })

  await user.type(picker, 'hệ thống')
  await user.click(await screen.findByRole('option', { name: 'Tạo thể loại “hệ thống”' }))
  expect(
    await screen.findByRole('button', { name: 'Bỏ thể loại Hệ thống' }, slow),
  ).toBeInTheDocument()
})

test('lọc không thấy thì gợi ý tạo đúng tên vừa gõ', async () => {
  signIn()
  const { user } = renderApp('/genres')
  await user.type(await screen.findByLabelText('Tìm thể loại', {}, slow), 'Xuyên nhanh')
  await user.click(await screen.findByRole('button', { name: 'Tạo thể loại “Xuyên nhanh”' }))
  expect(within(await screen.findByRole('dialog')).getByLabelText('Tên thể loại')).toHaveValue(
    'Xuyên nhanh',
  )
})
