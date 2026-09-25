import { screen, within } from '@testing-library/react'
import { signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }
beforeEach(() => localStorage.clear())

test('chưa đăng nhập vào trang tài khoản thì chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/tai-khoan')
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/dang-nhap?next=%2Ftai-khoan')
})

test('đổi tên hiển thị: header cập nhật ngay', async () => {
  signInAs('demo')
  const { user } = renderApp('/tai-khoan')
  const name = await screen.findByLabelText('Tên hiển thị', {}, slow)
  await user.clear(name)
  await user.type(name, 'Mèo Đọc Truyện')
  await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
  expect(await screen.findByText('Đã lưu hồ sơ.', {}, slow)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tài khoản của Mèo Đọc Truyện' })).toBeInTheDocument()
})

test('đổi mật khẩu: sai mật khẩu hiện tại thì báo, đúng thì đăng nhập được bằng mật khẩu mới', async () => {
  signInAs('demo')
  const { user } = renderApp('/tai-khoan')
  const section = (await screen.findByRole('heading', { name: 'Mật khẩu' }, slow)).closest(
    'section',
  )!
  const fill = async (current: string) => {
    for (const [label, value] of [
      ['Mật khẩu hiện tại', current],
      ['Mật khẩu mới', 'matkhaumoi456'],
      ['Nhập lại mật khẩu mới', 'matkhaumoi456'],
    ]) {
      const input = within(section).getByLabelText(label)
      await user.clear(input)
      await user.type(input, value)
    }
    await user.click(within(section).getByRole('button', { name: 'Đổi mật khẩu' }))
  }

  await fill('saimatkhau1')
  expect(
    await within(section).findByText('Mật khẩu hiện tại không đúng.', {}, slow),
  ).toBeInTheDocument()
  await fill('matkhau123')
  expect(await within(section).findByText('Đã đổi mật khẩu.', {}, slow)).toBeInTheDocument()

  const { signInWithPassword } = await import('./api')
  await expect(
    signInWithPassword({ email: 'demo@webtruyen.vn', password: 'matkhaumoi456' }),
  ).resolves.toMatchObject({ id: 'demo' })
})
