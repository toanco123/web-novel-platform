import { deleteAccount } from '@/features/auth/api'
import { addComment, getComments } from '@/features/comments/api'
import { followStory, getLibrary } from '@/features/library/api'
import { getStory } from '@/features/stories/api'
import { publishStory, registerUser, signInAs } from '@/test/helpers'

beforeEach(() => localStorage.clear())

test('xóa tài khoản xóa truyện của họ khỏi tủ truyện và bình luận của người khác', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await addComment('mong-hoa-luc', 'Linh bình luận truyện khác')

  signInAs('demo')
  await followStory(story.slug)
  await addComment(story.slug, 'Demo bình luận truyện của Linh')

  signInAs(linh)
  await deleteAccount({ password: 'matkhau123' })

  expect(await getStory(story.slug)).toBeNull()
  signInAs('demo')
  expect((await getLibrary()).map((e) => e.story.slug)).not.toContain(story.slug)
  const others = await getComments('mong-hoa-luc')
  expect(others.items.map((c) => c.content)).not.toContain('Linh bình luận truyện khác')
})
