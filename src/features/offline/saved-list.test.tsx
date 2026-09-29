import { screen, within } from '@testing-library/react'
import { registerUser } from '@/test/helpers'
import { fakeChapter, goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { listSavedStories, markRead, saveChapters } from './store'

const chapters = (slug: string, title: string, numbers: number[]) =>
  numbers.map((n) => fakeChapter(slug, n, { title }))
const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

test('liệt kê truyện có chương trong máy; "Đọc tiếp" mở chương đọc gần nhất', async () => {
  at('2026-09-01T00:00:00Z')
  await saveChapters(chapters('mua-ha', 'Mùa Hạ', [1, 2, 3]))
  at('2026-09-02T00:00:00Z')
  await saveChapters(chapters('dem-trang', 'Đêm Trắng', [7, 8]), { pinned: true })
  at('2026-09-03T00:00:00Z')
  await markRead('mua-ha', 2, 0.4)

  renderApp('/library?tab=saved')
  const list = await screen.findByRole('list', { name: 'Truyện đã lưu' }, { timeout: 3000 })
  const [first, second] = within(list).getAllByRole('listitem')
  expect(first).toHaveTextContent('Mùa Hạ')
  expect(first).toHaveTextContent('Đã lưu 3 chương (1–3)')
  expect(first).not.toHaveTextContent('Đã tải về')
  expect(within(first).getByRole('link', { name: 'Đọc tiếp' })).toHaveAttribute(
    'href',
    '/story/mua-ha/chapter-2',
  )
  expect(second).toHaveTextContent('Đêm Trắng')
  expect(second).toHaveTextContent('Đã tải về')
  expect(within(second).getByRole('link', { name: 'Đọc tiếp' })).toHaveAttribute(
    'href',
    '/story/dem-trang/chapter-7',
  )
  expect(screen.getByRole('link', { name: 'Đã lưu' })).toHaveAttribute('aria-current', 'page')
})

test('xóa một truyện; "Xóa tất cả" hỏi lại rồi xóa hết', async () => {
  await saveChapters(chapters('mua-ha', 'Mùa Hạ', [1]))
  await saveChapters(chapters('dem-trang', 'Đêm Trắng', [1]))
  const { user } = renderApp('/library?tab=saved')

  await user.click(
    await screen.findByRole('button', { name: 'Xóa Mùa Hạ khỏi máy' }, { timeout: 3000 }),
  )
  await expect.poll(() => screen.queryByText('Mùa Hạ')).toBeNull()
  expect((await listSavedStories()).map((s) => s.story.title)).toEqual(['Đêm Trắng'])

  await user.click(screen.getByRole('button', { name: 'Xóa tất cả' }))
  const dialog = await screen.findByRole('dialog', { name: 'Xóa mọi chương đã lưu?' })
  await user.click(within(dialog).getByRole('button', { name: 'Xóa hết' }))
  expect(await screen.findByText('Chưa có chương nào được lưu')).toBeInTheDocument()
  expect(await listSavedStories()).toEqual([])
})

test('mất mạng vẫn mở được tab Đã lưu, vẫn nhận ra tài khoản đang đăng nhập', async () => {
  await registerUser()
  await saveChapters(chapters('mua-ha', 'Mùa Hạ', [1]))
  goOffline()
  renderApp('/library?tab=saved')
  expect(await screen.findByText('Mùa Hạ', undefined, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Tài khoản của Linh/ })).toBeInTheDocument()
})
