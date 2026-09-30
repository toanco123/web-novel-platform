import { screen, within } from '@testing-library/react'
import { publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'
import { addComment, COMMENTS_PER_PAGE, getComments } from './api'

const slow = { timeout: 3000 }
// Truyện mẫu có hơn một trang bình luận
const SLUG = 'mong-hoa-luc'

beforeEach(() => localStorage.clear())

test('có bình luận mới từ nơi khác giữa hai lần tải thì "Xem thêm" không lặp lại bình luận đã hiện', async () => {
  const { total } = await getComments(SLUG)
  expect(total).toBeGreaterThan(COMMENTS_PER_PAGE)

  const { user } = renderApp(`/story/${SLUG}`)
  const list = await screen.findByRole('list', { name: 'Danh sách bình luận' }, slow)
  const items = () => within(list).getAllByRole('listitem')
  expect(items()).toHaveLength(COMMENTS_PER_PAGE)

  // Người khác bình luận (không qua cache của trang này): bình luận cũ lùi xuống một vị trí, nên
  // trang sau lấy theo vị trí sẽ bắt đầu bằng bình luận cuối của trang đầu
  signInAs('demo')
  await addComment(SLUG, 'Bình luận gửi từ nơi khác')

  await user.click(screen.getByRole('button', { name: 'Xem thêm bình luận' }))
  await expect.poll(() => items().length, slow).toBeGreaterThan(COMMENTS_PER_PAGE)
  expect(items()).toHaveLength(total)
})

test('trả lời bình luận: nhóm trả lời tự mở, thu gọn được, trả lời tiếp thì nhắc tên', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await addComment(story.slug, 'Truyện này kết HE hay SE vậy?')
  signInAs('demo')
  const { user } = renderApp(`/story/${story.slug}`)

  const list = await screen.findByRole('list', { name: 'Danh sách bình luận' }, slow)
  const root = within(list).getByRole('listitem')
  // Bình luận của người khác: trả lời và báo cáo được, không xóa được
  expect(within(root).getByRole('button', { name: 'Báo cáo' })).toBeInTheDocument()
  expect(within(root).queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument()

  await user.click(within(root).getByRole('button', { name: 'Trả lời' }))
  await user.type(within(root).getByLabelText('Viết trả lời'), 'HE nha bạn')
  await user.click(within(root).getByRole('button', { name: 'Gửi trả lời' }))

  const replies = await within(root).findByRole(
    'list',
    { name: 'Trả lời bình luận của Linh' },
    slow,
  )
  expect(await within(replies).findByText('HE nha bạn', {}, slow)).toBeInTheDocument()
  expect(within(root).queryByLabelText('Viết trả lời')).not.toBeInTheDocument()

  await user.click(within(root).getByRole('button', { name: 'Ẩn trả lời' }))
  expect(within(root).queryByText('HE nha bạn')).not.toBeInTheDocument()
  await user.click(await within(root).findByRole('button', { name: 'Xem 1 trả lời' }, slow))

  // Trả lời một câu trả lời: vẫn vào nhóm của bình luận gốc, ô nhập nhắc tên người được trả lời
  const reply = await within(root).findByText('HE nha bạn', {}, slow)
  await user.click(within(reply.closest('li')!).getByRole('button', { name: 'Trả lời' }))
  expect(within(root).getByLabelText('Viết trả lời')).toHaveValue('@Bạn đọc Demo ')
})

test('khách bấm Trả lời thì sang trang đăng nhập rồi quay lại truyện', async () => {
  const { router, user } = renderApp(`/story/${SLUG}`)
  const list = await screen.findByRole('list', { name: 'Danh sách bình luận' }, slow)
  await user.click(within(list).getAllByRole('button', { name: 'Trả lời' })[0])
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe(`/login?next=${encodeURIComponent(`/story/${SLUG}`)}`)
})

test('xóa bình luận có trả lời thì hộp thoại báo số trả lời mất theo', async () => {
  signInAs('demo')
  const root = await addComment(SLUG, 'Bình luận gốc của demo')
  await registerUser('Linh', 'linh@gmail.com')
  await addComment(SLUG, 'Trả lời của Linh', null, root.id)
  signOut()
  signInAs('demo')
  const { user } = renderApp(`/story/${SLUG}`)

  const mine = (await screen.findByText('Bình luận gốc của demo', {}, slow)).closest('li')!
  expect(within(mine).queryByRole('button', { name: 'Báo cáo' })).not.toBeInTheDocument()
  await user.click(within(mine).getByRole('button', { name: 'Xóa' }))
  expect(await screen.findByText(/1 trả lời bên dưới cũng sẽ bị xóa/, {}, slow)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xóa bình luận' }))
  await expect.poll(() => screen.queryByText('Bình luận gốc của demo'), slow).toBeNull()
  expect(await (await import('./api')).getReplies(root.id)).toEqual([])
})

test('báo cáo bình luận: chọn lý do, lý do khác phải có ghi chú', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const spam = await addComment(story.slug, 'Vào web abc chấm com đọc nhanh hơn')
  await registerUser('Mai', 'mai@gmail.com')
  const { user } = renderApp(`/story/${story.slug}`)

  const list = await screen.findByRole('list', { name: 'Danh sách bình luận' }, slow)
  await user.click(within(list).getByRole('button', { name: 'Báo cáo' }))
  const dialog = await screen.findByRole('dialog', { name: 'Báo cáo bình luận' }, slow)
  await user.click(within(dialog).getByRole('radio', { name: 'Lý do khác' }))
  await user.click(within(dialog).getByRole('button', { name: 'Gửi báo cáo' }))
  expect(await within(dialog).findByText('Mô tả ngắn lý do báo cáo')).toBeInTheDocument()

  await user.click(within(dialog).getByRole('radio', { name: 'Spam, quảng cáo' }))
  await user.click(within(dialog).getByRole('button', { name: 'Gửi báo cáo' }))
  expect(await screen.findByText('Đã gửi báo cáo', {}, slow)).toBeInTheDocument()

  signInAs('demo')
  const admin = await import('@/features/admin/api')
  expect((await admin.getAdminComments({ view: 'reported', page: 1 })).items).toEqual([
    expect.objectContaining({
      id: spam.id,
      reports: [expect.objectContaining({ reason: 'spam', reporterName: 'Mai' })],
    }),
  ])
})
