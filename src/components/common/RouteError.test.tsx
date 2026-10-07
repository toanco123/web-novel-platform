import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import userEvent from '@testing-library/user-event'
import { routes } from '@/app/router'
import { setPendingUpdate } from '@/lib/appUpdate'
import { reportError } from '@/lib/monitoring'
import { goOffline } from '@/test/offline'
import { RouteError } from './RouteError'

vi.mock('@/lib/monitoring', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/monitoring')>()),
  reportError: vi.fn(),
}))

/** Route mà file JS của trang không tải được (như mở khu Sáng tác lúc offline) */
const failingRouter = () =>
  createMemoryRouter([
    {
      path: '/',
      ErrorBoundary: RouteError,
      lazy: async () => {
        throw new TypeError('Failed to fetch dynamically imported module')
      },
    },
  ])

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

test('mọi route gốc dùng RouteError', () => {
  expect(routes.every((r) => r.ErrorBoundary === RouteError)).toBe(true)
})

test('mất mạng: báo trang cần có mạng, có link truyện đã lưu', async () => {
  goOffline()
  render(<RouterProvider router={failingRouter()} />)
  expect(await screen.findByText('Bạn đang offline')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Truyện đã lưu' })).toHaveAttribute(
    'href',
    '/library?tab=saved',
  )
})

test('có mạng mà vẫn lỗi: gợi ý tải lại trang', async () => {
  render(<RouterProvider router={failingRouter()} />)
  expect(await screen.findByText('Không mở được trang này')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeInTheDocument()
})

test('lỗi của trang được gửi qua reportError (việc lọc lỗi tải file JS nằm trong reportError)', async () => {
  render(<RouterProvider router={failingRouter()} />)
  await screen.findByText('Không mở được trang này')
  expect(reportError).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Failed to fetch dynamically imported module' }),
    { source: 'route' },
  )
})

test('trang không tồn tại (lỗi 404 của router) không gửi', async () => {
  const router = createMemoryRouter(
    [{ path: '/', ErrorBoundary: RouteError, Component: () => null }],
    { initialEntries: ['/khong-co'] },
  )
  render(<RouterProvider router={router} />)
  await screen.findByText('Không mở được trang này')
  expect(reportError).not.toHaveBeenCalled()
})

test('có bản mới đang chờ: "Tải lại trang" kích hoạt bản mới (bản cũ không còn file của trang)', async () => {
  const update = vi.fn()
  setPendingUpdate(update)
  try {
    const user = userEvent.setup()
    render(<RouterProvider router={failingRouter()} />)
    await user.click(await screen.findByRole('button', { name: 'Tải lại trang' }))
    expect(update).toHaveBeenCalled()
  } finally {
    setPendingUpdate(null)
  }
})
