import { screen, within } from '@testing-library/react'
import { addComment } from '@/features/comments/api'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }

beforeEach(() => localStorage.clear())

test('chặn người viết bình luận: bình luận biến mất, bỏ chặn ở trang Tài khoản', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await addComment(story.slug, 'Bình luận của Linh')
  signInAs('demo')
  const { user, router } = renderApp(`/story/${story.slug}`)

  const comment = (await screen.findByText('Bình luận của Linh', {}, slow)).closest('li')!
  await user.click(within(comment).getByRole('button', { name: 'Chặn' }))
  const dialog = await screen.findByRole('dialog', { name: 'Chặn Linh?' }, slow)
  await user.click(within(dialog).getByRole('button', { name: 'Chặn' }))
  await expect.poll(() => screen.queryByText('Bình luận của Linh'), slow).toBeNull()

  await router.navigate('/account')
  const list = await screen.findByRole('list', { name: 'Người đã chặn' }, slow)
  await user.click(within(list).getByRole('button', { name: 'Bỏ chặn Linh' }))
  expect(await screen.findByText(/Bạn chưa chặn ai/, {}, slow)).toBeInTheDocument()
})

test('bình luận của mình không có nút Chặn', async () => {
  signInAs('demo')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await addComment(story.slug, 'Bình luận của demo')
  renderApp(`/story/${story.slug}`)
  const mine = (await screen.findByText('Bình luận của demo', {}, slow)).closest('li')!
  expect(within(mine).queryByRole('button', { name: 'Chặn' })).not.toBeInTheDocument()
  expect(within(mine).getByRole('button', { name: 'Xóa' })).toBeInTheDocument()
})

test('khách bấm Chặn thì sang trang đăng nhập', async () => {
  const { user, router } = renderApp('/story/mong-hoa-luc')
  const list = await screen.findByRole('list', { name: 'Danh sách bình luận' }, slow)
  await user.click(within(list).getAllByRole('button', { name: 'Chặn' })[0])
  await expect.poll(() => router.state.location.pathname, slow).toBe('/login')
})
