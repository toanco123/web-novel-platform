import { screen, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }

beforeEach(() => localStorage.clear())

test('sai mật khẩu thì báo lỗi, đúng thì quay về trang ?next=', async () => {
  const { router, user } = renderApp('/dang-nhap?next=%2Fkhong-co-trang-nay')

  await user.type(await screen.findByLabelText('Email'), 'demo@webtruyen.vn')
  await user.type(screen.getByLabelText('Mật khẩu'), 'saimatkhau')
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect(await screen.findByRole('alert', {}, slow)).toHaveTextContent(
    'Email hoặc mật khẩu không đúng.',
  )

  await user.clear(screen.getByLabelText('Mật khẩu'))
  await user.type(screen.getByLabelText('Mật khẩu'), 'matkhau123')
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

  expect(
    await screen.findByRole('button', { name: 'Tài khoản của Bạn đọc Demo' }, slow),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/khong-co-trang-nay')
})

test('báo lỗi ngay tại ô khi rời ô với dữ liệu sai', async () => {
  const { user } = renderApp('/dang-ky')

  await user.type(await screen.findByLabelText('Email'), 'linh@')
  await user.tab()
  const email = screen.getByLabelText('Email')
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Nhập email hợp lệ, ví dụ ten@gmail.com')).toHaveAttribute(
    'id',
    email.getAttribute('aria-describedby'),
  )
})

test('đăng ký: email trùng báo lỗi, email mới thì đăng nhập luôn rồi đăng xuất được', async () => {
  const { router, user } = renderApp('/dang-ky')

  async function fill(email: string) {
    for (const [label, value] of [
      ['Tên hiển thị', 'Linh'],
      ['Email', email],
      ['Mật khẩu', 'matkhau123'],
      ['Nhập lại mật khẩu', 'matkhau123'],
    ]) {
      const input = await screen.findByLabelText(label)
      await user.clear(input)
      await user.type(input, value)
    }
  }

  await fill('demo@webtruyen.vn')
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
  expect(await screen.findByRole('alert', {}, slow)).toHaveTextContent('Email này đã được đăng ký')

  await fill('linh@gmail.com')
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))

  const account = await screen.findByRole('button', { name: 'Tài khoản của Linh' }, slow)
  expect(router.state.location.pathname).toBe('/')

  await user.click(account)
  const menu = await screen.findByRole('menu')
  await user.click(within(menu).getByRole('menuitem', { name: 'Đăng xuất' }))
  expect(await screen.findByRole('link', { name: 'Đăng nhập' }, slow)).toBeInTheDocument()
})

test('đã đăng nhập mà mở trang đăng nhập thì bị chuyển đi', async () => {
  localStorage.setItem('mock-auth-session', JSON.stringify('demo'))
  const { router } = renderApp('/dang-nhap')
  await screen.findByRole('button', { name: 'Tài khoản của Bạn đọc Demo' }, slow)
  expect(router.state.location.pathname).toBe('/')
})
