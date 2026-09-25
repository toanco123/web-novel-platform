import { screen, within } from '@testing-library/react'
import * as studio from '@/features/studio/api'
import { publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'
import { followStory } from './api'

const slow = { timeout: 3000 }
beforeEach(() => localStorage.clear())

test('khách vào tủ truyện: mặc định xem lịch sử, tab theo dõi mời đăng nhập', async () => {
  const { user } = renderApp('/tu-truyen')
  expect(await screen.findByText('Chưa có lịch sử đọc', {}, slow)).toBeInTheDocument()
  expect(screen.getByText(/Lịch sử đang lưu trên trình duyệt này/)).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Đang theo dõi' }))
  expect(await screen.findByText('Đăng nhập để theo dõi truyện', {}, slow)).toBeInTheDocument()
})

test('có chương mới: chấm trên avatar, số trong tab, nhãn trên truyện; bỏ theo dõi được', async () => {
  const reader = await registerUser()
  signInAs('demo')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  signInAs(reader)
  await followStory(story.slug)
  signInAs('demo')
  await studio.saveChapter(
    story.id,
    { title: 'Tái ngộ', content: 'Nội dung. '.repeat(20) },
    { publish: true },
  )
  signInAs(reader)

  const { user } = renderApp('/tu-truyen')
  expect(
    await screen.findByRole('button', { name: /1 truyện có chương mới/ }, slow),
  ).toBeInTheDocument()
  const list = await screen.findByRole('list', { name: 'Truyện đang theo dõi' }, slow)
  expect(within(list).getByText('1 chương mới')).toBeInTheDocument()
  expect(within(list).getByText('Chưa đọc')).toBeInTheDocument()

  await user.click(within(list).getByRole('button', { name: 'Bỏ theo dõi Mùa Hạ Năm Ấy' }))
  expect(await screen.findByText('Tủ truyện còn trống', {}, slow)).toBeInTheDocument()
})

test('lịch sử: xóa một truyện, xóa toàn bộ phải xác nhận', async () => {
  signInAs('demo')
  const now = new Date().toISOString()
  localStorage.setItem(
    'mock-history',
    JSON.stringify({
      demo: [
        { slug: 'mong-hoa-luc', chapter: 2, chapterTitle: 'A', progress: 0.5, readAt: now },
        { slug: 'truong-an-khong-tuyet', chapter: 9, chapterTitle: 'B', progress: 1, readAt: now },
      ],
    }),
  )
  const { user } = renderApp('/tu-truyen?muc=lich-su')
  const list = await screen.findByRole('list', { name: 'Lịch sử đọc' }, slow)
  expect(within(list).getByText('50%')).toBeInTheDocument()
  expect(within(list).getAllByRole('link', { name: 'Đọc tiếp' })[0]).toHaveAttribute(
    'href',
    '/truyen/mong-hoa-luc/chuong-2',
  )

  await user.click(within(list).getByRole('button', { name: 'Xóa Mộng Hoa Lục khỏi lịch sử' }))
  await expect.poll(() => within(list).queryAllByRole('listitem').length, slow).toBe(1)

  await user.click(screen.getByRole('button', { name: 'Xóa toàn bộ' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Xóa lịch sử' }))
  expect(await screen.findByText('Chưa có lịch sử đọc', {}, slow)).toBeInTheDocument()
  signOut()
})
