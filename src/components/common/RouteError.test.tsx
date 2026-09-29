import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/router'
import { goOffline } from '@/test/offline'
import { RouteError } from './RouteError'

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

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
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
