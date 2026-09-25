import { screen, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'
import { useReaderSettings, READER_DEFAULTS } from './useReaderSettings'

const base = '/truyen/truong-an-khong-tuyet' // 412 chương

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
})

test('mở chương: có tiêu đề, nội dung và nút chuyển chương đúng', async () => {
  renderApp(`${base}/chuong-12`)
  expect(await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.getAllByText('Chương 12').length).toBeGreaterThan(0)

  const [top] = screen.getAllByRole('navigation', { name: /Chuyển chương/ })
  expect(within(top).getByRole('link', { name: /Chương trước|Trước/ })).toHaveAttribute(
    'href',
    `${base}/chuong-11`,
  )
  expect(within(top).getByRole('link', { name: /Chương sau|Sau/ })).toHaveAttribute(
    'href',
    `${base}/chuong-13`,
  )
  expect(screen.getByRole('link', { name: /Đọc tiếp chương 13/ })).toBeInTheDocument()
})

test('phím → và ← chuyển chương', async () => {
  const { router, user } = renderApp(`${base}/chuong-12`)
  await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chuong-13`)
  await screen.findByRole('link', { name: /Đọc tiếp chương 14/ }, { timeout: 3000 })

  await user.keyboard('{ArrowLeft}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chuong-12`)
})

test('chương đầu không có "chương trước", chương cuối báo đã đọc tới chương mới nhất', async () => {
  renderApp(`${base}/chuong-412`)
  expect(
    await screen.findByText('Bạn đã đọc tới chương mới nhất', undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
  for (const nav of screen.getAllByRole('navigation', { name: /Chuyển chương/ })) {
    expect(within(nav).getByRole('button', { name: /Chương sau|Sau/ })).toBeDisabled()
  }
})

test('đường dẫn sai hoặc chương không tồn tại thì báo không tìm thấy', async () => {
  renderApp(`${base}/chuong-abc`)
  expect(
    await screen.findByText('Đường dẫn chương không hợp lệ.', undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
})

test('chương vượt quá số chương thì có link về trang truyện', async () => {
  renderApp(`${base}/chuong-9999`)
  expect(
    await screen.findByText(/Không tìm thấy chương 9999/, undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về trang truyện' })).toHaveAttribute('href', base)
})

test('cài đặt đọc áp dụng ngay và được lưu lại', async () => {
  const { user } = renderApp(`${base}/chuong-1`)
  await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

  await user.click(screen.getByRole('button', { name: 'Cài đặt đọc' }))
  const dialog = await screen.findByRole('dialog', { name: 'Cài đặt đọc' })
  await user.click(within(dialog).getByRole('button', { name: 'Tăng cỡ chữ' }))
  await user.click(within(dialog).getByRole('radio', { name: 'Giấy vàng' }))
  await user.click(within(dialog).getByRole('button', { name: 'Không chân' }))

  const paragraph = screen.getAllByText(/\S/, { selector: 'article p' }).at(-1)!
  expect(paragraph.parentElement).toHaveStyle({ fontSize: '20px' })
  expect(paragraph.parentElement).toHaveClass('font-sans')
  expect(document.querySelector('.reader-tone-paper')).not.toBeNull()
  expect(JSON.parse(localStorage.getItem('reader-settings')!).state).toMatchObject({
    fontSize: 20,
    tone: 'paper',
    font: 'sans',
  })
})

test('mục lục mở sẵn chương đang đọc và chọn chương thì chuyển trang', async () => {
  const { router, user } = renderApp(`${base}/chuong-60`)
  await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

  await user.click(screen.getByRole('button', { name: 'Mục lục' }))
  const dialog = await screen.findByRole('dialog', { name: 'Mục lục' })
  // Chương 60 nằm ở trang 51–100
  const current = await within(dialog).findByRole('link', { current: 'page' }, { timeout: 3000 })
  expect(current).toHaveAttribute('href', `${base}/chuong-60`)

  await user.click(within(dialog).getAllByRole('link')[0])
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chuong-51`)
  await expect.poll(() => screen.queryByRole('dialog', { name: 'Mục lục' })).toBeNull()
})
