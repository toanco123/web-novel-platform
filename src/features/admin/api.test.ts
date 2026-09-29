import { recordChapterView } from '@/features/chapters/api'
import * as studio from '@/features/studio/api'
import { publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import * as admin from './api'

beforeEach(() => localStorage.clear())

test('khách không xem được, người thường nhận AdminError', async () => {
  await expect(admin.getAdminOverview(7)).rejects.toMatchObject({ code: 'unauthenticated' })
  await registerUser()
  await expect(admin.getAdminUsers({ page: 1 })).rejects.toBeInstanceOf(admin.AdminError)
  await expect(admin.getAdminStories({ page: 1 })).rejects.toBeInstanceOf(admin.AdminError)
})

test('quản trị viên thấy người dùng mới, truyện nháp và số liệu', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 2)
  await studio.createStory({
    title: 'Bản Nháp Của Linh',
    description: 'Truyện chưa xuất bản, chỉ quản trị viên và tác giả thấy.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  signOut()
  await recordChapterView(story.slug, 1)
  await recordChapterView(story.slug, 2)

  signInAs('demo')
  const users = await admin.getAdminUsers({ q: 'LINH', page: 1 })
  expect(users.items).toEqual([
    expect.objectContaining({
      id: linh,
      email: 'linh@gmail.com',
      isAdmin: false,
      storyCount: 2,
    }),
  ])
  const all = await admin.getAdminUsers({ page: 1 })
  expect(all.items.find((u) => u.id === 'demo')).toMatchObject({ isAdmin: true })

  const drafts = await admin.getAdminStories({ visibility: 'draft', ownerId: linh, page: 1 })
  expect(drafts.items.map((s) => s.title)).toEqual(['Bản Nháp Của Linh'])
  const byViews = await admin.getAdminStories({ ownerId: linh, sort: 'views', page: 1 })
  expect(byViews.items[0]).toMatchObject({
    title: 'Mùa Hạ Năm Ấy',
    views: 2,
    publishedCount: 2,
    chapterCount: 2,
  })

  const overview = await admin.getAdminOverview(7)
  expect(overview.days).toHaveLength(7)
  const today = overview.days.at(-1)!
  expect(today).toMatchObject({ signups: 1, views: 2, stories: 2, chapters: 2 })
  expect(overview.totals).toMatchObject({ newUsers: 1, viewsInPeriod: 2 })
  expect(overview.totals.draftStories).toBe(1)
})

test('hộp thư: đọc tin nhắn liên hệ, đánh dấu đã xử lý', async () => {
  const { sendContactMessage } = await import('@/features/feedback/api')
  await sendContactMessage({
    name: 'Lan',
    email: 'lan@gmail.com',
    topic: 'bug',
    message: 'Trang tìm kiếm bị lỗi.',
  })
  await registerUser()
  await expect(admin.getAdminMessages({ status: 'open', page: 1 })).rejects.toBeInstanceOf(
    admin.AdminError,
  )

  signInAs('demo')
  const open = await admin.getAdminMessages({ status: 'open', page: 1 })
  expect(open.items).toEqual([
    expect.objectContaining({ name: 'Lan', topic: 'bug', handledAt: null }),
  ])
  expect((await admin.getAdminOverview(7)).totals.unhandledMessages).toBe(1)

  await admin.setMessageHandled(open.items[0].id, true)
  expect((await admin.getAdminMessages({ status: 'open', page: 1 })).total).toBe(0)
  const handled = await admin.getAdminMessages({ status: 'handled', page: 1 })
  expect(handled.items[0].handledAt).not.toBeNull()
})

test('báo lỗi toàn web: admin thấy báo lỗi truyện người khác và đánh dấu đã sửa', async () => {
  const { reportChapter } = await import('@/features/feedback/api')
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 2)
  await reportChapter({ slug: story.slug, chapter: 2, reason: 'typo', note: 'Sai chữ' })

  signInAs('demo')
  const open = await admin.getAdminReports({ status: 'open', page: 1 })
  expect(open.items).toEqual([
    expect.objectContaining({
      storyTitle: 'Mùa Hạ Năm Ấy',
      storyPublished: true,
      chapterNumber: 2,
      chapterTitle: 'Chương thử 2',
      reporter: expect.objectContaining({ displayName: 'Linh' }),
    }),
  ])
  await admin.setAdminReportStatus(open.items[0].id, 'resolved')
  expect((await admin.getAdminReports({ status: 'open', page: 1 })).total).toBe(0)
  expect((await admin.getAdminReports({ status: 'resolved', page: 1 })).total).toBe(1)
})
