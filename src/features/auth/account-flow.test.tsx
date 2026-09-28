import { screen, within } from '@testing-library/react'
import { getStory } from '@/features/stories/api'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { getSession, signInWithPassword, signInWithProvider } from './api'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }
beforeEach(() => localStorage.clear())

test('chưa đăng nhập vào trang tài khoản thì chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/account')
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/login?next=%2Faccount')
})

test('đổi tên hiển thị: header cập nhật ngay', async () => {
  signInAs('demo')
  const { user } = renderApp('/account')
  const name = await screen.findByLabelText('Tên hiển thị', {}, slow)
  await user.clear(name)
  await user.type(name, 'Mèo Đọc Truyện')
  await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
  expect(await screen.findByText('Đã lưu hồ sơ.', {}, slow)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tài khoản của Mèo Đọc Truyện' })).toBeInTheDocument()
})

test('đổi mật khẩu: sai mật khẩu hiện tại thì báo, đúng thì đăng nhập được bằng mật khẩu mới', async () => {
  signInAs('demo')
  const { user } = renderApp('/account')
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

test('xóa tài khoản email: sai mật khẩu thì báo, đúng thì xóa luôn truyện và về trang chủ', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const { router, user } = renderApp('/account')
  const section = (await screen.findByRole('heading', { name: 'Xóa tài khoản' }, slow)).closest(
    'section',
  )!
  expect(await within(section).findByText(/Bạn đang có 1 truyện/, {}, slow)).toBeInTheDocument()

  const password = within(section).getByLabelText('Nhập mật khẩu để xác nhận')
  await user.type(password, 'saimatkhau1')
  await user.click(within(section).getByRole('button', { name: 'Xóa tài khoản vĩnh viễn' }))
  expect(await within(section).findByText('Mật khẩu không đúng.', {}, slow)).toBeInTheDocument()

  await user.clear(password)
  await user.type(password, 'matkhau123')
  await user.click(within(section).getByRole('button', { name: 'Xóa tài khoản vĩnh viễn' }))
  await expect.poll(() => router.state.location.pathname, slow).toBe('/')
  expect(await screen.findByText(/Đã xóa tài khoản/, {}, slow)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument()

  expect(await getStory(story.slug)).toBeNull()
  await expect(
    signInWithPassword({ email: 'linh@gmail.com', password: 'matkhau123' }),
  ).rejects.toMatchObject({ code: 'invalid_credentials' })
})

test('xóa tài khoản Google: gõ đúng email mới xóa được', async () => {
  await signInWithProvider('google')
  const { router, user } = renderApp('/account')
  const section = (await screen.findByRole('heading', { name: 'Xóa tài khoản' }, slow)).closest(
    'section',
  )!
  const confirm = within(section).getByLabelText(/Gõ email ban-doc-google@example.com/)
  await user.type(confirm, 'nguoi-khac@example.com')
  await user.click(within(section).getByRole('button', { name: 'Xóa tài khoản vĩnh viễn' }))
  expect(
    await within(section).findByText('Email nhập vào chưa khớp với tài khoản'),
  ).toBeInTheDocument()

  await user.clear(confirm)
  await user.type(confirm, 'Ban-Doc-Google@example.com')
  await user.click(within(section).getByRole('button', { name: 'Xóa tài khoản vĩnh viễn' }))
  await expect.poll(() => router.state.location.pathname, slow).toBe('/')
  expect(await getSession()).toBeNull()
})
