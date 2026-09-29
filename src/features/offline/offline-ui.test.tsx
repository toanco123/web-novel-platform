import { screen, within } from '@testing-library/react'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { goOffline, goOnline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getSavedChapter } from './store'

const slug = 'truong-an-khong-tuyet'
const base = `/story/${slug}`
const heading = () => screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
})

test('trang thường: mất mạng thì có dải báo offline kèm link truyện đã lưu', async () => {
  renderApp('/')
  await screen.findByRole('contentinfo', undefined, { timeout: 3000 })
  expect(screen.queryByText('Bạn đang offline.')).toBeNull()
  goOffline()
  expect(await screen.findByText('Bạn đang offline.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Xem truyện đã lưu' })).toHaveAttribute(
    'href',
    '/library?tab=saved',
  )
  goOnline()
  await expect.poll(() => screen.queryByText('Bạn đang offline.')).toBeNull()
})

test('mục lục khi mất mạng chỉ hiện chương đã lưu', async () => {
  const { user } = renderApp(`${base}/chapter-12`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, 17), { timeout: 3000 }).not.toBeNull()
  goOffline()
  await user.click(screen.getByRole('button', { name: 'Mục lục' }))
  const dialog = await screen.findByRole('dialog', { name: 'Mục lục' })
  expect(await within(dialog).findByText('Đang offline, các chương đã lưu:')).toBeInTheDocument()
  const chapters = within(dialog)
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'))
    .filter((href) => href?.includes('/chapter-'))
  expect(chapters).toEqual([12, 13, 14, 15, 16, 17].map((n) => `${base}/chapter-${n}`))
})

test('mất mạng: khu bình luận báo cần mạng, nút báo lỗi bị khóa', async () => {
  renderApp(`${base}/chapter-12`)
  await heading()
  goOffline()
  expect(
    await screen.findByText('Cần có mạng để xem và gửi bình luận chương 12.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Báo lỗi chương' })).toBeDisabled()
})
