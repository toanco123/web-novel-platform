// Bản Supabase (api.remote.ts) chạy trên client giả: mỗi truy vấn được await nhận lần lượt một kết
// quả soạn sẵn trong fake.responses, chuỗi lệnh (from, select, eq, insert...) được ghi lại để kiểm
// tra. Ở đây chỉ kiểm phần chạy trên máy (đánh số chương, map lỗi, ảnh bìa, đổi kiểu dữ liệu); RLS,
// trigger và RPC trên database thật do lượt test tích hợp kiểm tra.
import * as api from './api.remote'

type Call = [method: string, ...args: unknown[]]
type Response = { data: unknown; error: unknown }

const fake = vi.hoisted(() => ({
  cdn: 'https://cdn.test/covers/',
  userId: null as string | null,
  responses: [] as Response[],
  queries: [] as Call[][],
  uploaded: [] as string[],
  removed: [] as string[],
}))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({
    from: (table: string) => fakeQuery(['from', table]),
    rpc: (fn: string, args: object) => fakeQuery(['rpc', fn, args]),
  }),
}))
vi.mock('@/features/auth/api', async () => {
  const shared =
    await vi.importActual<typeof import('@/features/auth/shared')>('@/features/auth/shared')
  const getUserId = async () => fake.userId
  const requireUserId = async () => {
    if (!fake.userId) throw shared.unauthenticated()
    return fake.userId
  }
  return { getUserId, requireUserId, unauthenticated: shared.unauthenticated }
})
vi.mock('@/lib/imageUpload', () => ({
  isDataUrl: (value: string | null) => !!value?.startsWith('data:'),
  publicImageUrl: (_bucket: string, path: string) => fake.cdn + path,
  uploadImage: async (_bucket: string, userId: string) => {
    fake.uploaded.push(`${userId}/moi.webp`)
    return `${userId}/moi.webp`
  },
  removeImage: async (_bucket: string, path: string | null) => {
    if (path) fake.removed.push(path)
  },
}))

/** Builder giả: ghi lại chuỗi lệnh, khi được await thì trả kết quả kế tiếp trong fake.responses */
function fakeQuery(first: Call) {
  const calls: Call[] = [first]
  fake.queries.push(calls)
  const builder: object = new Proxy(
    {},
    {
      get: (_, method) =>
        method === 'then'
          ? (resolve: (value: Response) => void, reject: (error: Error) => void) => {
              const next = fake.responses.shift()
              if (next) resolve(next)
              else reject(new Error(`Thiếu kết quả cho truy vấn ${JSON.stringify(calls)}`))
            }
          : (...args: unknown[]) => {
              calls.push([String(method), ...args])
              return builder
            },
    },
  )
  return builder
}

const USER = 'u1'
const STORY_ID = '5f0c6a8e-3b1d-4c55-9a7e-2d4b8c1e9f00'
const TIME = '2026-09-28T03:00:00+00:00'

const ok = (data: unknown): Response => ({ data, error: null })
const fail = (code: string, message = code): Response => ({
  data: null,
  error: { code, message, details: '', hint: '' },
})
/** Lỗi nghiệp vụ của trigger/RPC (raise exception '<mã>') */
const business = (code: string) => fail('P0001', code)

const lastQuery = () => fake.queries.at(-1)!
const writes = () =>
  fake.queries.filter((q) => q.some(([m]) => m === 'insert' || m === 'update' || m === 'delete'))
const rpcArgs = () => lastQuery()[0][2] as Record<string, unknown>

const input = {
  title: '  Mùa   Hạ  ',
  description: ' Giới thiệu truyện. ',
  genreSlugs: ['ngon-tinh', 'ngon-tinh', 'hien-dai'],
  status: 'ongoing' as const,
  coverUrl: null,
}
const chapter = { title: 'Gặp lại', content: 'Nội dung chương.' }

const studioRow = (over: object = {}) => ({
  id: STORY_ID,
  slug: 'mua-ha',
  title: 'Mùa Hạ',
  description: 'Giới thiệu truyện.',
  genre_slugs: ['ngon-tinh', 'hien-dai'],
  status: 'ongoing',
  visibility: 'draft',
  cover_path: null,
  owner_id: USER,
  owner_name: 'Linh',
  created_at: TIME,
  updated_at: TIME,
  published_at: null,
  chapter_count: 0,
  published_count: 0,
  draft_count: 0,
  views: 0,
  followers: 0,
  open_reports: 0,
  review_status: null,
  review_submitted_at: null,
  reviewed_at: null,
  review_reason: null,
  ...over,
})
const chapterRow = (number: number, over: object = {}) => ({
  id: `c${number}`,
  story_id: STORY_ID,
  number,
  title: `Chương ${number}`,
  content: 'Nội dung chương.',
  status: 'draft',
  created_at: TIME,
  updated_at: TIME,
  published_at: null,
  ...over,
})
/** Kết quả kiểm tra chủ truyện (stories.select('slug, cover_path')) */
const own = (coverPath: string | null = null) => ok({ slug: 'mua-ha', cover_path: coverPath })

beforeEach(() => {
  fake.userId = USER
  fake.responses = []
  fake.queries = []
  fake.uploaded = []
  fake.removed = []
})

afterEach(() => expect(fake.responses, 'còn kết quả chưa dùng').toEqual([]))

test('khách: báo cần đăng nhập, không gửi truy vấn nào', async () => {
  fake.userId = null
  await expect(api.getMyStories()).rejects.toMatchObject({ code: 'unauthenticated' })
  await expect(api.getMyStory(STORY_ID)).rejects.toMatchObject({ code: 'unauthenticated' })
  await expect(api.saveChapter(STORY_ID, chapter)).rejects.toMatchObject({
    name: 'AuthError',
    code: 'unauthenticated',
  })
  expect(fake.queries).toEqual([])
})

test('truyện không có, id hỏng hoặc của người khác: not_found (getMyStory trả null)', async () => {
  // Id gõ tay trên URL không phải uuid: không hỏi máy chủ
  expect(await api.getMyStory('khong-phai-uuid')).toBeNull()
  await expect(api.getMyChapters('khong-phai-uuid')).rejects.toMatchObject({ code: 'not_found' })
  expect(fake.queries).toEqual([])

  fake.responses = [ok(null)]
  expect(await api.getMyStory(STORY_ID)).toBeNull()

  // Chỉ tìm trong truyện của mình: truyện công khai của người khác cũng là không thấy
  fake.responses = [ok(null)]
  await expect(api.getMyChapters(STORY_ID)).rejects.toMatchObject({ code: 'not_found' })
  expect(lastQuery()).toContainEqual(['eq', 'owner_id', USER])
  fake.responses = [ok(null)]
  await expect(api.getStoryReports(STORY_ID)).rejects.toMatchObject({ code: 'not_found' })

  // RLS bỏ qua dòng của người khác: không dòng nào được sửa/xóa
  fake.responses = [ok([])]
  await expect(api.publishStory(STORY_ID)).rejects.toMatchObject({ code: 'not_found' })
  fake.responses = [ok([])]
  await expect(api.setChapterStatus(STORY_ID, 1, 'draft')).rejects.toMatchObject({
    code: 'not_found',
  })
  fake.responses = [ok([])]
  await expect(api.deleteChapter(STORY_ID, 1)).rejects.toMatchObject({ code: 'not_found' })
  fake.responses = [own(), ok([])]
  await expect(
    api.setReportStatus(STORY_ID, '0d4c6a8e-3b1d-4c55-9a7e-2d4b8c1e9f11', 'resolved'),
  ).rejects.toMatchObject({ code: 'not_found' })

  // Số chương hỏng trên URL: chỉ kiểm tra chủ truyện rồi trả null như bản giả
  fake.responses = [own()]
  expect(await api.getMyChapter(STORY_ID, Number('abc'))).toBeNull()
})

test('lỗi của trigger/RPC thành StudioError/AuthError, lỗi khác giữ nguyên', async () => {
  fake.responses = [business('no_published_chapters')]
  await expect(api.publishStory(STORY_ID)).rejects.toMatchObject({
    name: 'StudioError',
    code: 'no_published_chapters',
  })
  fake.responses = [business('last_published_chapter')]
  await expect(api.deleteChapter(STORY_ID, 1)).rejects.toMatchObject({
    code: 'last_published_chapter',
  })
  fake.responses = [business('too_many_genres')]
  await expect(api.createStory(input)).rejects.toMatchObject({
    code: 'too_many_genres',
    message: 'Chọn tối đa 5 thể loại.',
  })
  fake.responses = [business('unauthenticated')]
  await expect(api.createStory(input)).rejects.toMatchObject({
    name: 'AuthError',
    code: 'unauthenticated',
  })
  // Nơi khác vừa thêm chương cùng số: unique (story_id, number)
  fake.responses = [ok({ chapters: [] }), fail('23505', 'duplicate key value')]
  await expect(api.saveChapter(STORY_ID, chapter)).rejects.toMatchObject({
    code: 'chapter_exists',
  })

  const other = fail('42501', 'permission denied for view studio_stories')
  fake.responses = [other]
  await expect(api.getMyStories()).rejects.toBe(other.error)
})

test('tạo truyện: một lần RPC, tên gọn khoảng trắng, chương đầu tùy chọn', async () => {
  fake.responses = [ok(studioRow({ chapter_count: 1, published_count: 1 }))]
  const story = await api.createStory(input, {
    chapter: { title: ' Mở đầu ', content: '\nNội dung chương.\n' },
    publish: true,
  })
  expect(lastQuery()[0]).toEqual([
    'rpc',
    'create_story',
    {
      p_title: 'Mùa Hạ',
      p_description: 'Giới thiệu truyện.',
      p_status: 'ongoing',
      p_genres: ['ngon-tinh', 'hien-dai'],
      p_cover_path: undefined,
      p_first_chapter: { number: undefined, title: 'Mở đầu', content: 'Nội dung chương.' },
      p_publish: true,
    },
  ])
  expect(story).toEqual({
    id: STORY_ID,
    slug: 'mua-ha',
    title: 'Mùa Hạ',
    description: 'Giới thiệu truyện.',
    genreSlugs: ['ngon-tinh', 'hien-dai'],
    status: 'ongoing',
    coverUrl: null,
    owner: { id: USER, displayName: 'Linh' },
    visibility: 'draft',
    createdAt: TIME,
    updatedAt: TIME,
    publishedAt: null,
    chapterCount: 1,
    publishedCount: 1,
    draftCount: 0,
    views: 0,
    followers: 0,
    openReports: 0,
    takedown: null,
    review: null,
    authorName: null,
  })

  fake.responses = [ok(studioRow())]
  await api.createStory(input)
  expect(rpcArgs()).toMatchObject({ p_first_chapter: null, p_publish: false })
})

test('ảnh bìa: lưu lỗi thì xóa ảnh vừa upload, đổi hoặc bỏ ảnh thì xóa ảnh cũ', async () => {
  fake.responses = [business('too_many_genres')]
  await expect(
    api.createStory({ ...input, coverUrl: 'data:image/webp;base64,AAAA' }),
  ).rejects.toMatchObject({ code: 'too_many_genres' })
  expect(fake.uploaded).toEqual(['u1/moi.webp'])
  expect(fake.removed).toEqual(['u1/moi.webp'])

  // Giữ ảnh cũ: gửi lại đường dẫn cũ, không upload, không xóa
  fake.uploaded = []
  fake.removed = []
  fake.responses = [own('u1/cu.webp'), ok(studioRow({ cover_path: 'u1/cu.webp' }))]
  const kept = await api.updateStory(STORY_ID, { ...input, coverUrl: fake.cdn + 'u1/cu.webp' })
  expect(rpcArgs()).toMatchObject({ p_id: STORY_ID, p_cover_path: 'u1/cu.webp' })
  expect(kept.coverUrl).toBe(fake.cdn + 'u1/cu.webp')
  expect([fake.uploaded, fake.removed]).toEqual([[], []])

  // Ảnh mới: upload, lưu xong mới xóa ảnh cũ
  fake.responses = [own('u1/cu.webp'), ok(studioRow({ cover_path: 'u1/moi.webp' }))]
  await api.updateStory(STORY_ID, { ...input, coverUrl: 'data:image/webp;base64,AAAA' })
  expect(rpcArgs()).toMatchObject({ p_cover_path: 'u1/moi.webp' })
  expect(fake.removed).toEqual(['u1/cu.webp'])

  // Form cũ (tab khác đã đổi bìa và xóa file cũ) gửi URL bìa cũ: giữ bìa đang lưu, không xóa gì
  fake.removed = []
  fake.responses = [own('u1/moi.webp'), ok(studioRow({ cover_path: 'u1/moi.webp' }))]
  await api.updateStory(STORY_ID, { ...input, coverUrl: fake.cdn + 'u1/cu.webp' })
  expect(rpcArgs()).toMatchObject({ p_cover_path: 'u1/moi.webp' })
  expect(fake.removed).toEqual([])
  // Truyện mới chỉ nhận ảnh vừa chọn: URL có sẵn thì coi như chưa có bìa
  fake.responses = [ok(studioRow())]
  await api.createStory({ ...input, coverUrl: fake.cdn + 'u1/cua-truyen-khac.webp' })
  expect(rpcArgs().p_cover_path).toBeUndefined()

  // Bỏ ảnh: không gửi p_cover_path (tham số mặc định null)
  fake.removed = []
  fake.responses = [own('u1/moi.webp'), ok(studioRow())]
  await api.updateStory(STORY_ID, input)
  expect(rpcArgs().p_cover_path).toBeUndefined()
  expect(fake.removed).toEqual(['u1/moi.webp'])

  // Xóa truyện: xóa luôn file bìa
  fake.removed = []
  fake.responses = [own('u1/cu.webp'), ok([{ id: STORY_ID }])]
  await api.deleteStory(STORY_ID)
  expect(lastQuery()).toContainEqual(['delete'])
  expect(fake.removed).toEqual(['u1/cu.webp'])
})

test('lưu chương: đánh số và kiểm tra như bản giả trước khi ghi', async () => {
  const meta = ok({
    chapters: [
      { id: 'c1', number: 1, status: 'published', published_at: TIME },
      { id: 'c3', number: 3, status: 'draft', published_at: null },
    ],
  })

  // Chương mới: số tiếp theo sau chương cuối, cắt khoảng trắng, là nháp
  fake.responses = [meta, ok([chapterRow(4)])]
  const created = await api.saveChapter(STORY_ID, { title: ' Bốn ', content: '\nNội dung.\n' })
  expect(created).toMatchObject({ id: 'c4', storyId: STORY_ID, number: 4, status: 'draft' })
  expect(lastQuery()).toContainEqual([
    'insert',
    { story_id: STORY_ID, number: 4, title: 'Bốn', content: 'Nội dung.', status: 'draft' },
  ])

  // Lỗi báo trước, không ghi gì
  fake.responses = [meta]
  await expect(api.saveChapter(STORY_ID, { ...chapter, newNumber: 3 })).rejects.toMatchObject({
    code: 'chapter_exists',
  })
  fake.responses = [meta]
  await expect(
    api.saveChapter(STORY_ID, { ...chapter, number: 1, newNumber: 2 }),
  ).rejects.toMatchObject({ code: 'chapter_number_locked' })
  fake.responses = [meta]
  await expect(api.saveChapter(STORY_ID, { ...chapter, number: 2 })).rejects.toMatchObject({
    code: 'not_found',
  })
  expect(writes()).toHaveLength(1)

  // Sửa chương nháp: đổi số được, xuất bản thì đặt status (published_at do trigger ghi)
  fake.responses = [meta, ok([chapterRow(2, { id: 'c3', status: 'published' })])]
  await api.saveChapter(STORY_ID, { ...chapter, number: 3, newNumber: 2 }, { publish: true })
  expect(lastQuery()).toContainEqual([
    'update',
    { number: 2, title: 'Gặp lại', content: 'Nội dung chương.', status: 'published' },
  ])
  expect(lastQuery()).toContainEqual(['eq', 'id', 'c3'])

  // Sửa chương đã xuất bản, không bấm xuất bản: giữ nguyên trạng thái
  fake.responses = [meta, ok([chapterRow(1, { status: 'published' })])]
  await api.saveChapter(STORY_ID, { ...chapter, number: 1 })
  expect(lastQuery()).toContainEqual([
    'update',
    { number: 1, title: 'Gặp lại', content: 'Nội dung chương.' },
  ])
})

test('nhập nhiều chương: đánh số tiếp nối sau chương lớn nhất, một lần insert', async () => {
  fake.responses = [
    ok({ chapters: [{ id: 'c5', number: 5, status: 'published', published_at: TIME }] }),
    ok([chapterRow(7, { status: 'published' }), chapterRow(6, { status: 'published' })]),
  ]
  const added = await api.importChapters(STORY_ID, [chapter, chapter], true)
  expect(added.map((c) => [c.number, c.status])).toEqual([
    [6, 'published'],
    [7, 'published'],
  ])
  const insert = lastQuery().find(([method]) => method === 'insert')!
  expect(insert[1]).toMatchObject([
    { number: 6, status: 'published' },
    { number: 7, status: 'published' },
  ])

  // Không có chương nào để nhập: chỉ kiểm tra chủ truyện
  fake.responses = [ok({ chapters: [] })]
  expect(await api.importChapters(STORY_ID, [], false)).toEqual([])
  expect(writes()).toHaveLength(1)
})

test('thống kê và báo lỗi đổi về đúng kiểu của bản giả', async () => {
  const viewsByDay = Array.from({ length: 7 }, (_, i) => ({ day: `2026-09-2${i + 2}`, views: i }))
  fake.responses = [
    ok({
      views: 21,
      viewsRecent: 21,
      viewsByDay,
      viewsByChapter: [{ number: 1, title: 'Gặp lại', views: 21 }],
      followers: 2,
      ratingAvg: 4.5,
      ratingCount: 2,
      comments: 3,
      // bigint của Postgres về dạng chuỗi
      votes: { total: '12', week: 4 },
    }),
  ]
  expect(await api.getStoryStats(STORY_ID)).toEqual({
    views: 21,
    viewsRecent: 21,
    viewsByDay,
    viewsByChapter: [{ number: 1, title: 'Gặp lại', views: 21 }],
    followers: 2,
    ratingAvg: 4.5,
    ratingCount: 2,
    comments: 3,
    votes: { total: 12, week: 4 },
  })
  expect(lastQuery()[0]).toEqual(['rpc', 'studio_story_stats', { p_story_id: STORY_ID }])

  fake.responses = [
    own(),
    ok([
      {
        id: 'r1',
        chapter_number: 2,
        reason: 'typo',
        note: 'Sai chính tả',
        status: 'open',
        created_at: TIME,
        reporter: { id: 'u2', display_name: 'Minh' },
      },
    ]),
  ]
  expect(await api.getStoryReports(STORY_ID)).toEqual([
    {
      id: 'r1',
      storySlug: 'mua-ha',
      chapterNumber: 2,
      reason: 'typo',
      note: 'Sai chính tả',
      reporter: { id: 'u2', displayName: 'Minh' },
      status: 'open',
      createdAt: TIME,
    },
  ])
  // Chưa xử lý trước (thứ tự enum), rồi mới nhất trước
  expect(lastQuery().filter(([method]) => method === 'order')).toEqual([
    ['order', 'status'],
    ['order', 'created_at', { ascending: false }],
    ['order', 'id'],
  ])
  expect(lastQuery()).toContainEqual(['range', 0, 999])
})

test('danh sách dài hơn max_rows (1000 dòng, kể cả mảng nhúng): đọc đủ theo từng trang', async () => {
  const chapters = Array.from({ length: 1001 }, (_, i) => chapterRow(i + 1))
  fake.responses = [
    ok({ chapters: chapters.slice(0, 1000) }),
    ok({ chapters: chapters.slice(1000) }),
  ]
  const all = await api.getMyChapters(STORY_ID)
  expect(all.map((c) => c.number)).toEqual(chapters.map((c) => c.number))
  expect(fake.queries.map((q) => q.find(([method]) => method === 'range'))).toEqual([
    ['range', 0, 999, { referencedTable: 'chapters' }],
    ['range', 1000, 1999, { referencedTable: 'chapters' }],
  ])

  // Số chương mới tính sau chương lớn nhất, kể cả khi truyện có hơn 1000 chương
  fake.responses = [
    ok({ chapters: chapters.slice(0, 1000) }),
    ok({ chapters: chapters.slice(1000) }),
    ok([chapterRow(1002)]),
  ]
  await api.saveChapter(STORY_ID, chapter)
  expect(lastQuery()).toContainEqual(['insert', expect.objectContaining({ number: 1002 })])

  // Báo lỗi vừa đúng 1000: trang sau quá cuối danh sách (416) coi như rỗng
  const report = {
    id: 'r1',
    chapter_number: 1,
    reason: 'typo',
    note: '',
    status: 'resolved',
    created_at: TIME,
    reporter: { id: 'u2', display_name: 'Minh' },
  }
  fake.responses = [own(), ok(Array.from({ length: 1000 }, () => report)), fail('PGRST103')]
  expect(await api.getStoryReports(STORY_ID)).toHaveLength(1000)
})

test('mở lại báo lỗi khi bạn đọc đã gửi lại đúng báo lỗi đó (còn mở): báo lỗi rõ ràng', async () => {
  const reportId = '0d4c6a8e-3b1d-4c55-9a7e-2d4b8c1e9f11'
  fake.responses = [own(), fail('23505', 'duplicate key value')]
  await expect(api.setReportStatus(STORY_ID, reportId, 'open')).rejects.toMatchObject({
    name: 'StudioError',
    code: 'report_already_open',
  })
  expect(lastQuery()).toContainEqual(['update', { status: 'open' }])

  fake.responses = [own(), ok([{ id: reportId }])]
  await api.setReportStatus(STORY_ID, reportId, 'resolved')
})

test('gửi duyệt: gọi RPC rồi đọc lại truyện; trạng thái duyệt và mã lỗi mới', async () => {
  fake.responses = [
    ok(null),
    ok(studioRow({ review_status: 'pending', review_submitted_at: TIME })),
  ]
  const story = await api.submitStoryForReview(STORY_ID)
  expect(fake.queries.at(-2)![0]).toEqual([
    'rpc',
    'submit_story_for_review',
    { p_story_id: STORY_ID },
  ])
  expect(story.review).toEqual({
    status: 'pending',
    submittedAt: TIME,
    reviewedAt: null,
    reason: null,
  })

  fake.responses = [business('already_pending')]
  await expect(api.submitStoryForReview(STORY_ID)).rejects.toMatchObject({
    name: 'StudioError',
    code: 'already_pending',
  })
  fake.responses = [business('story_not_approved')]
  await expect(api.publishStory(STORY_ID)).rejects.toMatchObject({ code: 'story_not_approved' })
  await expect(api.submitStoryForReview('khong-phai-uuid')).rejects.toMatchObject({
    code: 'not_found',
  })
})

test('hẹn giờ: chỉ gửi scheduled_at khi có truyền, xếp lịch gọi RPC, map invalid_schedule', async () => {
  const AT = '2026-10-10T13:00:00.000Z'
  const meta = ok({ chapters: [{ id: 'c1', number: 1, status: 'published', published_at: TIME }] })

  // Chương mới kèm giờ hẹn
  fake.responses = [meta, ok([chapterRow(2, { scheduled_at: AT })])]
  expect(await api.saveChapter(STORY_ID, chapter, { scheduledAt: AT })).toMatchObject({
    number: 2,
    status: 'draft',
    scheduledAt: AT,
  })
  expect(lastQuery()).toContainEqual([
    'insert',
    { ...chapter, story_id: STORY_ID, number: 2, status: 'draft', scheduled_at: AT },
  ])

  // Xuất bản ngay: không gửi giờ hẹn (trigger bỏ giờ hẹn)
  fake.responses = [meta, ok([chapterRow(2, { status: 'published' })])]
  await api.saveChapter(STORY_ID, chapter, { publish: true, scheduledAt: AT })
  expect(lastQuery()).toContainEqual([
    'insert',
    { ...chapter, story_id: STORY_ID, number: 2, status: 'published' },
  ])

  // Hủy hẹn một chương; hẹn chương đã xuất bản thì trigger báo invalid_schedule
  fake.responses = [ok([chapterRow(2, { scheduled_at: null })])]
  expect(await api.setChapterSchedule(STORY_ID, 2, null)).toMatchObject({ scheduledAt: null })
  expect(lastQuery()).toContainEqual(['update', { scheduled_at: null }])
  expect(lastQuery()).toContainEqual(['eq', 'number', 2])
  fake.responses = [business('invalid_schedule')]
  await expect(api.setChapterSchedule(STORY_ID, 1, AT)).rejects.toMatchObject({
    code: 'invalid_schedule',
  })
  fake.responses = [ok([])]
  await expect(api.setChapterSchedule(STORY_ID, 9, AT)).rejects.toMatchObject({
    code: 'not_found',
  })

  // Xếp lịch: một lần RPC, đổi tên khóa sang { number, at }
  fake.responses = [ok(2)]
  expect(
    await api.scheduleChapters(STORY_ID, [
      { number: 2, scheduledAt: AT },
      { number: 3, scheduledAt: AT },
    ]),
  ).toBe(2)
  expect(lastQuery()[0]).toEqual([
    'rpc',
    'schedule_chapters',
    {
      p_story_id: STORY_ID,
      p_items: [
        { number: 2, at: AT },
        { number: 3, at: AT },
      ],
    },
  ])
  fake.responses = [business('not_found')]
  await expect(
    api.scheduleChapters(STORY_ID, [{ number: 9, scheduledAt: AT }]),
  ).rejects.toMatchObject({ code: 'not_found' })
})
