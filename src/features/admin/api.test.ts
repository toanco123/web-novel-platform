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

test('khóa tài khoản: người bị khóa mất phiên, không đăng nhập lại được; mở khóa thì được', async () => {
  const { getSession, signInWithPassword } = await import('@/features/auth/api')
  const linh = await registerUser('Linh', 'linh@gmail.com')

  signInAs('demo')
  await expect(admin.setUserBanned('demo', true)).rejects.toMatchObject({
    code: 'cannot_ban_self',
  })
  await admin.setUserBanned(linh, true)
  expect((await admin.getAdminUsers({ q: 'linh', page: 1 })).items[0].isBanned).toBe(true)
  expect((await admin.getAdminOverview(7)).totals.bannedUsers).toBe(1)

  signInAs(linh)
  expect(await getSession()).toBeNull()
  const login = { email: 'linh@gmail.com', password: 'matkhau123' }
  await expect(signInWithPassword(login)).rejects.toMatchObject({ code: 'banned' })

  signInAs('demo')
  await admin.setUserBanned(linh, false)
  await expect(signInWithPassword(login)).resolves.toMatchObject({ id: linh })
})

test('gỡ truyện: truyện ẩn khỏi người đọc, tác giả thấy lý do và không tự công khai lại được', async () => {
  const { getStory } = await import('@/features/stories/api')
  const studio = await import('@/features/studio/api')
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)

  signInAs('demo')
  await admin.setStoryTakedown(story.id, 'Đạo văn')
  const listed = await admin.getAdminStories({ ownerId: linh, page: 1 })
  expect(listed.items[0]).toMatchObject({ visibility: 'draft', takedown: { reason: 'Đạo văn' } })
  expect(await getStory(story.slug)).toBeNull()

  signInAs(linh)
  expect((await studio.getMyStory(story.id))?.takedown).toMatchObject({ reason: 'Đạo văn' })
  await expect(studio.publishStory(story.id)).rejects.toMatchObject({ code: 'story_taken_down' })

  signInAs('demo')
  await admin.setStoryTakedown(story.id, null)
  signInAs(linh)
  expect((await studio.publishStory(story.id)).visibility).toBe('published')
})

test('thể loại: sửa tên (slug đổi theo), gộp, xóa; truyện đi theo', async () => {
  const { createGenre } = await import('@/features/genres/api')
  const studio = await import('@/features/studio/api')
  await registerUser('Linh', 'linh@gmail.com')
  await createGenre({ name: 'Tình cảm' })
  await createGenre({ name: 'Học đường' })
  const story = await studio.createStory({
    title: 'Mùa Hạ Năm Ấy',
    description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
    genreSlugs: ['tinh-cam', 'hoc-duong'],
    status: 'ongoing',
    coverUrl: null,
  })

  signInAs('demo')
  await expect(
    admin.updateGenre('ngon-tinh', { name: 'Ngôn', description: '' }),
  ).rejects.toMatchObject({ code: 'builtin_genre' })
  await expect(
    admin.updateGenre('tinh-cam', { name: 'học đường', description: '' }),
  ).rejects.toMatchObject({ code: 'genre_exists' })

  expect(await admin.updateGenre('tinh-cam', { name: 'lãng mạn', description: 'Mô tả' })).toEqual({
    slug: 'lang-man',
    name: 'Lãng mạn',
    description: 'Mô tả',
  })
  const genresOf = async () => {
    signInAs(story.owner.id)
    const genres = (await studio.getMyStory(story.id))?.genreSlugs
    signInAs('demo')
    return genres
  }
  expect(await genresOf()).toEqual(['lang-man', 'hoc-duong'])

  expect(await admin.mergeGenres('lang-man', 'hoc-duong')).toBe(0)
  expect(await genresOf()).toEqual(['hoc-duong'])
  await admin.deleteGenre('hoc-duong')
  expect(await genresOf()).toEqual([])
})

test('truyện chọn tay: lưu theo thứ tự, trang chủ dùng danh sách đã chọn', async () => {
  const stories = await import('@/features/stories/api')
  const auto = (await stories.getFeaturedStories()).map((s) => s.slug)
  await registerUser('Linh', 'linh@gmail.com')
  const a = await publishStory('Mùa Hạ Năm Ấy', 1)
  const b = await publishStory('Gió Qua Hiên Nhà', 1)
  await expect(admin.setCuratedStories('featured', [a.id])).rejects.toBeInstanceOf(admin.AdminError)

  signInAs('demo')
  expect(await admin.getCuratedStories('featured')).toEqual([])
  await admin.setCuratedStories('featured', [b.id, a.id, b.id])
  expect(await admin.getCuratedStories('featured')).toEqual([
    { id: b.id, slug: b.slug, title: 'Gió Qua Hiên Nhà', authorName: 'Linh', isPublic: true },
    { id: a.id, slug: a.slug, title: 'Mùa Hạ Năm Ấy', authorName: 'Linh', isPublic: true },
  ])
  expect((await stories.getFeaturedStories()).map((s) => s.slug)).toEqual([b.slug, a.slug])
  // Danh sách kia không đổi
  expect(await admin.getCuratedStories('editor_pick')).toEqual([])

  // Truyện bị gỡ vẫn nằm trong danh sách của admin nhưng không lên trang chủ
  await admin.setStoryTakedown(b.id, 'Đạo văn')
  expect((await admin.getCuratedStories('featured')).map((s) => s.isPublic)).toEqual([false, true])
  expect((await stories.getFeaturedStories()).map((s) => s.slug)).toEqual([a.slug])

  // Bỏ hết thì trang chủ tự chọn lại như cũ
  await admin.setCuratedStories('featured', [])
  expect((await stories.getFeaturedStories()).map((s) => s.slug)).toEqual(auto)
})

test('truyện chọn tay: chặn quá số lượng và truyện không tồn tại', async () => {
  signInAs('demo')
  const { items } = await admin.getAdminStories({ page: 1 })
  const ids = items.map((s) => s.id)
  await expect(
    admin.setCuratedStories('featured', ids.slice(0, admin.CURATED_LIMITS.featured + 1)),
  ).rejects.toMatchObject({ code: 'too_many_curated' })
  await expect(admin.setCuratedStories('editor_pick', ['khong-co'])).rejects.toMatchObject({
    code: 'not_found',
  })
  await admin.setCuratedStories('editor_pick', ids.slice(0, 2))
  const stories = await import('@/features/stories/api')
  expect((await stories.getEditorPicks()).map((s) => s.id)).toEqual(ids.slice(0, 2))
})
