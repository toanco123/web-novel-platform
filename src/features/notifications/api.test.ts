import { reviewStory, setStoryTakedown } from '@/features/admin/api'
import { AuthError } from '@/features/auth/api'
import { addComment } from '@/features/comments/api'
import { blockUser } from '@/features/blocks/api'
import { draftStory, publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import * as studio from '@/features/studio/api'
import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationsRead,
  safeNotificationLink,
  unreadLabel,
} from './api'

beforeEach(() => localStorage.clear())

test('cần đăng nhập', async () => {
  await expect(getNotifications(1, 10)).rejects.toBeInstanceOf(AuthError)
  await expect(getUnreadNotificationCount()).rejects.toBeInstanceOf(AuthError)
})

test('bình luận gốc báo chủ truyện, trả lời báo người viết gốc, tự viết thì không báo', async () => {
  const owner = await registerUser('Chủ', 'chu@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const reader = await registerUser('Linh', 'linh@gmail.com')
  const root = await addComment(story.slug, 'Truyện hay quá')
  await addComment(story.slug, 'Tự trả lời', null, root.id)

  signInAs(owner)
  const [first] = (await getNotifications(1, 10)).items
  expect(first).toMatchObject({
    type: 'comment.story',
    title: 'Linh bình luận trong "Mùa Hạ Năm Ấy"',
    body: 'Truyện hay quá',
    link: `/story/${story.slug}`,
    read: false,
  })
  await addComment(story.slug, 'Cảm ơn bạn', null, root.id)
  // Truyện được duyệt + bình luận của Linh; Linh tự trả lời mình thì không báo
  expect(await getUnreadNotificationCount()).toBe(2)

  signInAs(reader)
  const { items } = await getNotifications(1, 10)
  expect(items).toHaveLength(1)
  expect(items[0]).toMatchObject({ type: 'comment.reply', body: 'Cảm ơn bạn' })
  expect(items[0].title).toBe('Chủ đã trả lời bình luận của bạn')
})

test('người đã chặn thì không nhận thông báo bình luận', async () => {
  const owner = await registerUser('Chủ', 'chu@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const mai = await registerUser('Mai', 'mai@gmail.com')
  signInAs(owner)
  await blockUser(mai)
  signInAs(mai)
  await addComment(story.slug, 'Bình luận của người bị chặn')
  signInAs(owner)
  // Chỉ còn thông báo truyện được duyệt
  expect((await getNotifications(1, 10)).items.map((n) => n.type)).toEqual(['story.approved'])
})

test('duyệt, từ chối, gỡ và khôi phục truyện báo chủ truyện kèm lý do', async () => {
  const owner = await registerUser('Chủ', 'chu@gmail.com')
  const story = await draftStory('Mùa Hạ Năm Ấy', 1)
  await studio.submitStoryForReview(story.id)
  signInAs('demo')
  await reviewStory({ storyId: story.id, approve: false, reason: 'Thiếu giới thiệu' })
  signInAs(owner)
  await studio.submitStoryForReview(story.id)
  signInAs('demo')
  await reviewStory({ storyId: story.id, approve: true })
  await setStoryTakedown(story.id, 'Vi phạm bản quyền')
  await setStoryTakedown(story.id, null)

  signInAs(owner)
  const items = (await getNotifications(1, 10)).items
  expect(items.map((n) => n.type)).toEqual([
    'story.restored',
    'story.takedown',
    'story.approved',
    'story.rejected',
  ])
  expect(items[1].body).toBe('Vi phạm bản quyền')
  expect(items[3].body).toBe('Thiếu giới thiệu')
  expect(items[0].link).toBe(`/studio/story/${story.id}`)
})

test('đánh dấu đã đọc, đọc hết, xóa và phân trang', async () => {
  const owner = await registerUser('Chủ', 'chu@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  for (const name of ['Linh', 'Mai', 'Hoa']) {
    await registerUser(name, `${name.toLowerCase()}@gmail.com`)
    await addComment(story.slug, `Bình luận của ${name}`)
  }
  signInAs(owner)
  // Truyện được duyệt cũng có một thông báo
  expect(await getUnreadNotificationCount()).toBe(4)
  const page1 = await getNotifications(1, 3)
  expect(page1).toMatchObject({ total: 4, pageCount: 2, page: 1 })

  await markNotificationsRead([page1.items[0].id])
  expect(await getUnreadNotificationCount()).toBe(3)
  await markAllNotificationsRead()
  expect(await getUnreadNotificationCount()).toBe(0)
  await deleteNotification(page1.items[1].id)
  expect((await getNotifications(1, 10)).total).toBe(3)
  // Trang vượt quá: kẹp về trang cuối
  expect((await getNotifications(9, 3)).page).toBe(1)
})

test('thông báo của người này không lẫn sang người kia, khách bị từ chối', async () => {
  await registerUser('Chủ', 'chu@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await registerUser('Linh', 'linh@gmail.com')
  await addComment(story.slug, 'Hay')
  expect(await getUnreadNotificationCount()).toBe(0)
  signOut()
  await expect(getNotifications(1, 10)).rejects.toBeInstanceOf(AuthError)
})

test('đường dẫn thông báo chỉ nhận đường dẫn nội bộ; huy hiệu tối đa 99+', () => {
  expect(safeNotificationLink('/story/a')).toBe('/story/a')
  expect(safeNotificationLink('//evil.com')).toBeNull()
  expect(safeNotificationLink('https://evil.com')).toBeNull()
  expect(safeNotificationLink(null)).toBeNull()
  expect(unreadLabel(7)).toBe('7')
  expect(unreadLabel(100)).toBe('99+')
})
