import { recordChapterView } from '@/features/chapters/api'
import * as studio from '@/features/studio/api'
import { pendingStory, publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
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
  // Gỡ làm mất dấu đã duyệt: khôi phục xong phải gửi duyệt lại
  await expect(studio.publishStory(story.id)).rejects.toMatchObject({ code: 'story_not_approved' })
  expect((await studio.submitStoryForReview(story.id)).review?.status).toBe('pending')
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

test('kiểm duyệt bình luận: xem bình luận bị báo cáo, bỏ qua báo cáo, xóa bình luận', async () => {
  const comments = await import('@/features/comments/api')
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const spam = await comments.addComment(story.slug, 'Vào web abc chấm com đọc nhanh hơn')
  await comments.addComment(story.slug, 'Bình luận chương của Linh', 1)
  await comments.addComment(story.slug, 'Trả lời quảng cáo', null, spam.id)
  await expect(admin.getAdminComments({ view: 'all', page: 1 })).rejects.toBeInstanceOf(
    admin.AdminError,
  )
  await expect(admin.deleteAdminComment(spam.id)).rejects.toBeInstanceOf(admin.AdminError)
  await expect(admin.dismissCommentReports(spam.id)).rejects.toBeInstanceOf(admin.AdminError)

  await registerUser('Mai', 'mai@gmail.com')
  await comments.reportComment({ commentId: spam.id, reason: 'offensive', note: '' })
  await comments.reportComment({ commentId: spam.id, reason: 'spam', note: ' Quảng cáo web khác ' })

  signInAs('demo')
  const all = await admin.getAdminComments({ view: 'all', page: 1 })
  expect(all.items.map((c) => c.content)).toEqual([
    'Trả lời quảng cáo',
    'Bình luận chương của Linh',
    'Vào web abc chấm com đọc nhanh hơn',
  ])
  expect(all.items[0]).toMatchObject({ isReply: true, replyCount: 0, reports: [] })
  expect(all.items[1]).toMatchObject({ chapterNumber: 1, isReply: false })
  // Tìm không dấu theo nội dung hoặc tên người viết
  expect((await admin.getAdminComments({ view: 'all', q: 'QUANG CAO', page: 1 })).total).toBe(1)
  expect((await admin.getAdminComments({ view: 'all', q: 'linh', page: 1 })).total).toBe(3)

  const reported = await admin.getAdminComments({ view: 'reported', page: 1 })
  expect(reported.items).toEqual([
    expect.objectContaining({
      id: spam.id,
      author: { id: linh, displayName: 'Linh' },
      storySlug: story.slug,
      storyTitle: 'Mùa Hạ Năm Ấy',
      storyPublished: true,
      chapterNumber: null,
      isReply: false,
      replyCount: 1,
      // Báo lại thì cập nhật báo cáo đang mở, không tạo thêm
      reports: [
        expect.objectContaining({
          reason: 'spam',
          note: 'Quảng cáo web khác',
          reporterName: 'Mai',
        }),
      ],
    }),
  ])
  expect((await admin.getAdminOverview(7)).totals.reportedComments).toBe(1)

  await admin.dismissCommentReports(spam.id)
  expect((await admin.getAdminComments({ view: 'reported', page: 1 })).items).toEqual([])
  expect((await admin.getAdminOverview(7)).totals.reportedComments).toBe(0)
  expect((await admin.getAdminComments({ view: 'all', page: 1 })).total).toBe(3)

  // Xóa bình luận gốc: trả lời mất theo
  await admin.deleteAdminComment(spam.id)
  const left = await admin.getAdminComments({ view: 'all', page: 1 })
  expect(left.items.map((c) => c.content)).toEqual(['Bình luận chương của Linh'])
  await expect(admin.deleteAdminComment(spam.id)).rejects.toMatchObject({ code: 'not_found' })
})

// ── Lọc, sắp xếp, phân trang ────────────────────────────────────────────

test('người dùng: lọc theo vai trò, trạng thái; sắp theo tên và số truyện; đổi số dòng', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  await publishStory('Mùa Hạ Năm Ấy', 1)
  const mai = await registerUser('Mai', 'mai@gmail.com')
  signInAs('demo')
  await admin.setUserBanned(mai, true)
  const ids = async (query: Partial<admin.AdminUserQuery>) =>
    (await admin.getAdminUsers({ page: 1, ...query })).items.map((u) => u.id)

  expect(await ids({ role: 'admin' })).toEqual(['demo'])
  expect((await ids({ role: 'member' })).sort()).toEqual([linh, mai].sort())
  expect(await ids({ status: 'banned' })).toEqual([mai])
  expect(await ids({ status: 'active', role: 'member' })).toEqual([linh])
  expect(await ids({ provider: 'google' })).toEqual([])
  expect(await ids({ provider: 'email' })).toHaveLength(3)

  expect(await ids({ sort: 'name', order: 'asc' })).toEqual(['demo', linh, mai])
  expect(await ids({ sort: 'name', order: 'desc' })).toEqual([mai, linh, 'demo'])
  expect((await ids({ sort: 'stories', order: 'desc' }))[0]).toBe(linh)
  // Mặc định: mới tham gia trước
  expect(await ids({})).toEqual([mai, linh, 'demo'])

  const small = await admin.getAdminUsers({ page: 2, pageSize: 10, sort: 'name', order: 'asc' })
  expect(small).toMatchObject({ total: 3, page: 1, pageCount: 1 })
  // Số dòng ngoài 10/20/50/100 thì dùng mặc định
  expect(admin.adminPageSize(7)).toBe(admin.ADMIN_PAGE_SIZE)
  expect(admin.adminPageSize(50)).toBe(50)
  expect(admin.adminPageSize(undefined)).toBe(admin.ADMIN_PAGE_SIZE)
})

test('truyện: lọc theo tiến độ, bị gỡ, có báo lỗi; sắp theo tên và số chương', async () => {
  const feedback = await import('@/features/feedback/api')
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const a = await publishStory('Mùa Hạ Năm Ấy', 3)
  const b = await publishStory('Gió Qua Hiên Nhà', 1)
  const c = await studio.createStory({
    title: 'Chuyện Đã Xong',
    description: 'Một câu chuyện đã viết xong, kết thúc có hậu.',
    genreSlugs: ['ngon-tinh'],
    status: 'completed',
    coverUrl: null,
  })
  await registerUser('Mai', 'mai@gmail.com')
  await feedback.reportChapter({ slug: a.slug, chapter: 1, reason: 'typo', note: '' })
  signInAs('demo')
  await admin.setStoryTakedown(b.id, 'Đạo văn')
  const titles = async (query: Partial<admin.AdminStoryQuery>) =>
    (await admin.getAdminStories({ page: 1, ownerId: linh, ...query })).items.map((s) => s.title)

  expect(await titles({ status: 'completed' })).toEqual(['Chuyện Đã Xong'])
  expect(await titles({ visibility: 'takedown' })).toEqual(['Gió Qua Hiên Nhà'])
  expect(await titles({ visibility: 'published' })).toEqual(['Mùa Hạ Năm Ấy'])
  expect((await titles({ visibility: 'draft' })).sort()).toEqual([
    'Chuyện Đã Xong',
    'Gió Qua Hiên Nhà',
  ])
  expect(await titles({ hasReports: true })).toEqual(['Mùa Hạ Năm Ấy'])
  expect(await titles({ sort: 'title', order: 'asc' })).toEqual([
    'Chuyện Đã Xong',
    'Gió Qua Hiên Nhà',
    'Mùa Hạ Năm Ấy',
  ])
  expect((await titles({ sort: 'chapters', order: 'desc' }))[0]).toBe('Mùa Hạ Năm Ấy')
  expect((await titles({ sort: 'reports', order: 'desc' }))[0]).toBe('Mùa Hạ Năm Ấy')
  expect((await titles({ sort: 'created', order: 'asc' }))[0]).toBe('Mùa Hạ Năm Ấy')
  expect(c.id).toBeTruthy()

  // Cùng truyện có sẵn thì nhiều hơn một trang 10 dòng
  const first = await admin.getAdminStories({ page: 1, pageSize: 10, sort: 'views', order: 'desc' })
  const second = await admin.getAdminStories({
    page: 2,
    pageSize: 10,
    sort: 'views',
    order: 'desc',
  })
  expect(first.items).toHaveLength(10)
  expect(first.total).toBeGreaterThan(10)
  expect(second).toMatchObject({ page: 2, pageCount: Math.ceil(first.total / 10) })
  expect(second.items).toHaveLength(Math.min(10, first.total - 10))
  // Giảm dần theo lượt đọc, liền mạch giữa hai trang
  const views = [...first.items, ...second.items].map((s) => s.views)
  expect(views).toEqual([...views].sort((a, b) => b - a))
})

test('hộp thư: lọc theo chủ đề, tìm không dấu, đổi chiều sắp xếp', async () => {
  const { sendContactMessage } = await import('@/features/feedback/api')
  await sendContactMessage({
    name: 'Lan',
    email: 'lan@gmail.com',
    topic: 'copyright',
    message: 'Truyện này đăng lại khi chưa xin phép tác giả.',
  })
  await sendContactMessage({
    name: 'Hùng',
    email: 'hung@gmail.com',
    topic: 'bug',
    message: 'Trang đọc bị lỗi trên điện thoại.',
  })
  signInAs('demo')
  const names = async (query: Partial<admin.AdminMessageQuery>) =>
    (await admin.getAdminMessages({ status: 'all', page: 1, ...query })).items.map((m) => m.name)

  expect(await names({})).toEqual(['Hùng', 'Lan'])
  expect(await names({ order: 'asc' })).toEqual(['Lan', 'Hùng'])
  expect(await names({ topic: 'bug' })).toEqual(['Hùng'])
  expect(await names({ q: 'XIN PHEP' })).toEqual(['Lan'])
  expect(await names({ q: 'hung@gmail' })).toEqual(['Hùng'])
  expect(await names({ q: 'dien thoai', topic: 'copyright' })).toEqual([])
})

test('báo lỗi chương: lọc theo lý do, tìm theo truyện, ghi chú, người báo', async () => {
  const { reportChapter } = await import('@/features/feedback/api')
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 2)
  await registerUser('Mai', 'mai@gmail.com')
  await reportChapter({
    slug: story.slug,
    chapter: 1,
    reason: 'typo',
    note: 'Sai chính tả dòng ba',
  })
  await reportChapter({ slug: story.slug, chapter: 2, reason: 'violation', note: 'Nội dung lạ' })
  signInAs('demo')
  const notes = async (query: Partial<admin.AdminReportQuery>) =>
    (await admin.getAdminReports({ status: 'all', page: 1, ...query })).items.map((r) => r.note)

  expect(await notes({})).toEqual(['Nội dung lạ', 'Sai chính tả dòng ba'])
  expect(await notes({ order: 'asc' })).toEqual(['Sai chính tả dòng ba', 'Nội dung lạ'])
  expect(await notes({ reason: 'violation' })).toEqual(['Nội dung lạ'])
  expect(await notes({ q: 'chinh ta' })).toEqual(['Sai chính tả dòng ba'])
  expect(await notes({ q: 'mua ha' })).toHaveLength(2)
  expect(await notes({ q: 'MAI' })).toHaveLength(2)
  expect(await notes({ q: 'khong co' })).toEqual([])
})

test('bình luận: lọc bình luận gốc / trả lời, sắp theo lúc viết', async () => {
  const comments = await import('@/features/comments/api')
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const root = await comments.addComment(story.slug, 'Bình luận gốc')
  await comments.addComment(story.slug, 'Trả lời', null, root.id)
  await comments.addComment(story.slug, 'Bình luận thứ hai')
  signInAs('demo')
  const contents = async (query: Partial<admin.AdminCommentQuery>) =>
    (await admin.getAdminComments({ view: 'all', page: 1, ...query })).items.map((c) => c.content)

  expect(await contents({ kind: 'reply' })).toEqual(['Trả lời'])
  expect(await contents({ kind: 'root' })).toEqual(['Bình luận thứ hai', 'Bình luận gốc'])
  expect(await contents({ sort: 'created', order: 'asc' })).toEqual([
    'Bình luận gốc',
    'Trả lời',
    'Bình luận thứ hai',
  ])
  expect((await admin.getAdminComments({ view: 'all', page: 1, pageSize: 10 })).pageCount).toBe(1)
})

test('duyệt truyện: hàng chờ theo lúc gửi, xem trước, số liệu, duyệt thì công khai', async () => {
  const { getStory } = await import('@/features/stories/api')
  const { getChapter } = await import('@/features/chapters/api')
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const a = await pendingStory('Mùa Hạ Năm Ấy')
  await studio.updateStory(a.id, {
    title: 'Mùa Hạ Năm Ấy',
    description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
    authorName: 'Bút danh Lá',
  })
  const b = await pendingStory('Gió Qua Hiên Nhà')

  // Người lạ không thấy truyện chờ duyệt
  signOut()
  expect(await getStory(a.slug)).toBeNull()

  signInAs('demo')
  // Quản trị viên xem trước được truyện và chương đã xuất bản của nó
  expect(await getStory(a.slug)).toMatchObject({ visibility: 'draft' })
  expect(await getChapter(a.slug, 1)).toMatchObject({ number: 1 })

  const queue = await admin.getAdminStories({
    review: 'pending',
    sort: 'submitted',
    order: 'asc',
    page: 1,
  })
  expect(queue.items.map((s) => s.title)).toEqual(['Mùa Hạ Năm Ấy', 'Gió Qua Hiên Nhà'])
  expect(queue.items[0]).toMatchObject({
    ownerId: linh,
    authorName: 'Bút danh Lá',
    genreSlugs: ['ngon-tinh'],
    review: { status: 'pending' },
  })
  expect((await admin.getAdminOverview(7)).totals.pendingReviews).toBe(2)

  await admin.reviewStory({ storyId: a.id, approve: true })
  await admin.reviewStory({ storyId: b.id, approve: false, reason: 'Bìa vi phạm' })
  expect((await admin.getAdminOverview(7)).totals.pendingReviews).toBe(0)
  const rejected = await admin.getAdminStories({ review: 'rejected', page: 1 })
  expect(rejected.items).toEqual([
    expect.objectContaining({
      title: 'Gió Qua Hiên Nhà',
      review: expect.objectContaining({ reason: 'Bìa vi phạm' }),
    }),
  ])

  signOut()
  expect(await getStory(a.slug)).toMatchObject({ visibility: 'published' })
  expect(await getStory(b.slug)).toBeNull()
})

test('gỡ truyện đang chờ duyệt thì rời hàng chờ; người thường không duyệt được', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await pendingStory('Mùa Hạ Năm Ấy')
  await expect(admin.reviewStory({ storyId: story.id, approve: true })).rejects.toBeInstanceOf(
    admin.AdminError,
  )
  signInAs('demo')
  await admin.setStoryTakedown(story.id, 'Đạo văn')
  expect((await admin.getAdminStories({ review: 'pending', page: 1 })).total).toBe(0)
  await expect(admin.reviewStory({ storyId: story.id, approve: true })).rejects.toMatchObject({
    code: 'not_pending',
  })
})
