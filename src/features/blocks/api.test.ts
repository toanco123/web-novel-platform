import { AuthError } from '@/features/auth/api'
import { addComment, getComments, getReplies } from '@/features/comments/api'
import { publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import { blockUser, getBlockedUsers, unblockUser } from './api'

beforeEach(() => localStorage.clear())

const contents = async (slug: string) => (await getComments(slug)).items.map((c) => c.content)

test('chặn cần đăng nhập, không tự chặn mình', async () => {
  await expect(blockUser('nguoi-khac')).rejects.toBeInstanceOf(AuthError)
  signInAs('demo')
  await expect(blockUser('demo')).rejects.toThrow('Bạn không thể chặn chính mình.')
})

test('chặn ẩn bình luận và trả lời của người đó với riêng mình; bỏ chặn thì hiện lại', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await addComment(story.slug, 'Bình luận của Linh')
  await registerUser('Mai', 'mai@gmail.com')
  const root = await addComment(story.slug, 'Bình luận của Mai')
  signInAs(linh)
  await addComment(story.slug, 'Linh trả lời Mai', null, root.id)

  signInAs('demo')
  await blockUser(linh)
  await blockUser(linh) // bấm hai lần: vẫn một dòng
  expect(await contents(story.slug)).toEqual(['Bình luận của Mai'])
  expect((await getComments(story.slug)).items[0].replyCount).toBe(0)
  expect(await getReplies(root.id)).toEqual([])
  expect(await getBlockedUsers()).toEqual([
    {
      user: expect.objectContaining({ id: linh, displayName: 'Linh' }),
      blockedAt: expect.any(String),
    },
  ])

  // Người khác và khách vẫn thấy
  signOut()
  expect(await contents(story.slug)).toContain('Bình luận của Linh')

  signInAs('demo')
  await unblockUser(linh)
  expect(await contents(story.slug)).toContain('Bình luận của Linh')
  expect(await getBlockedUsers()).toEqual([])
})

test('chặn được người viết bình luận mẫu, danh sách lấy tên từ bình luận đó', async () => {
  signInAs('demo')
  const [first] = (await getComments('mong-hoa-luc')).items
  await blockUser(first.user.id)
  expect((await getComments('mong-hoa-luc')).items.map((c) => c.user.id)).not.toContain(
    first.user.id,
  )
  expect((await getBlockedUsers())[0].user.displayName).toBe(first.user.displayName)
})
