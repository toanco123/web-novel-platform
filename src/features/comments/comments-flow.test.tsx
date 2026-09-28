import { screen, within } from '@testing-library/react'
import { signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'
import { addComment, COMMENTS_PER_PAGE, getComments } from './api'

const slow = { timeout: 3000 }
// Truyện mẫu có hơn một trang bình luận
const SLUG = 'mong-hoa-luc'

beforeEach(() => localStorage.clear())

test('có bình luận mới từ nơi khác giữa hai lần tải thì "Xem thêm" không lặp lại bình luận đã hiện', async () => {
  const { total } = await getComments(SLUG)
  expect(total).toBeGreaterThan(COMMENTS_PER_PAGE)

  const { user } = renderApp(`/truyen/${SLUG}`)
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
