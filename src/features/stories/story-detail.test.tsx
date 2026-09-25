import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }
const URL = '/truyen/truong-an-khong-tuyet'

beforeEach(() => localStorage.clear())
const signIn = () => localStorage.setItem('mock-auth-session', JSON.stringify('demo'))

function getChapters() {
  const section = document.getElementById('danh-sach-chuong')!
  return within(section).getAllByRole('link', { name: /^Chương \d+:/ })
}

test('hiển thị thông tin truyện và danh sách chương', async () => {
  renderApp(URL)
  expect(await screen.findByRole('heading', { level: 1, name: 'Trường An Không Tuyết' }, slow))
  await screen.findByRole('link', { name: /^Chương 1: / }, slow)
  expect(getChapters()).toHaveLength(50)
})

test('phân trang và đổi thứ tự chương đều ghi lên URL', async () => {
  const { router, user } = renderApp(URL)
  await user.click(await screen.findByRole('link', { name: 'Trang 2' }, slow))
  expect(router.state.location.search).toBe('?trang=2')
  await screen.findByRole('link', { name: /^Chương 51: / }, slow)

  await user.click(screen.getByRole('link', { name: 'Mới nhất' }))
  expect(router.state.location.search).toBe('?sap-xep=moi')
  await screen.findByRole('link', { name: /^Chương 412: / }, slow)
  expect(getChapters()[0]).toHaveTextContent('Chương 412:')
})

test('đi tới chương ngoài khoảng thì báo lỗi, trong khoảng thì mở chương', async () => {
  const { router, user } = renderApp(URL)
  const input = await screen.findByLabelText('Đi tới chương', {}, slow)
  await user.type(input, '500')
  await user.click(screen.getByRole('button', { name: 'Đi tới' }))
  expect(screen.getByText('Nhập số chương từ 1 đến 412')).toBeInTheDocument()

  await user.clear(input)
  await user.type(input, '12{Enter}')
  // Trang đích lazy-load nên URL đổi sau khi module tải xong
  await expect.poll(() => router.state.location.pathname, slow).toBe(`${URL}/chuong-12`)
})

test('chưa đăng nhập bấm thêm vào tủ thì sang trang đăng nhập kèm next', async () => {
  const { router, user } = renderApp(URL)
  await user.click(await screen.findByRole('button', { name: 'Thêm vào tủ truyện' }, slow))
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe(`/dang-nhap?next=${encodeURIComponent(URL)}`)
})

test('đã đăng nhập: thêm vào tủ được lưu theo tài khoản', async () => {
  signIn()
  const { user } = renderApp(URL)
  const button = await screen.findByRole('button', { name: 'Thêm vào tủ truyện' }, slow)
  // Nút bị khóa cho tới khi biết trạng thái tủ truyện của user
  await waitFor(() => expect(button).toBeEnabled(), slow)
  await user.click(button)
  expect(
    await screen.findByRole('button', { name: 'Đã thêm vào tủ truyện', pressed: true }, slow),
  ).toBeInTheDocument()
  // Nút đổi ngay (optimistic); dữ liệu được lưu sau khi api trả về
  await expect
    .poll(() => JSON.parse(localStorage.getItem('mock-library') ?? 'null'), slow)
    .toEqual({ demo: ['truong-an-khong-tuyet'] })
})

test('đăng nhập rồi gửi và xóa bình luận', async () => {
  signIn()
  const { user } = renderApp(URL)
  await user.type(await screen.findByLabelText('Viết bình luận', {}, slow), 'Chương này hay quá')
  await user.click(screen.getByRole('button', { name: 'Gửi bình luận' }))

  const list = await screen.findByRole('list', { name: 'Danh sách bình luận' }, slow)
  const mine = await within(list).findByText('Chương này hay quá', {}, slow)
  expect(within(list).getAllByRole('listitem')[0]).toContainElement(mine)

  const first = within(list).getAllByRole('listitem')[0]
  await user.click(within(first).getByRole('button', { name: 'Xóa' }))
  await user.click(await screen.findByRole('button', { name: 'Xóa bình luận' }))
  await expect.poll(() => screen.queryByText('Chương này hay quá'), slow).toBeNull()
})

test('slug không tồn tại thì hiện trang 404', async () => {
  renderApp('/truyen/khong-co-truyen-nay')
  expect(await screen.findByText(/Không tìm thấy truyện này/, {}, slow)).toBeInTheDocument()
})
