// Bản Supabase (api.remote.ts) chạy trên client giả: mỗi truy vấn được await trả kết quả do
// fake.respond quyết định theo chuỗi lệnh đã ghi (from/rpc, select, eq, in...). Ở đây chỉ kiểm phần
// chạy trên máy: thứ tự ghi chỗ đọc, gộp lịch sử khách, lọc dòng hỏng và chia bộ lọc .in(); RLS,
// trigger và RPC trên database thật do lượt test tích hợp kiểm tra.
import { getLibrary, getLibraryUpdateCount, saveReadingProgress } from './api.remote'
import { loadGuestHistory } from './guestHistory'

type Call = [method: string, ...args: unknown[]]
type Response = { data: unknown; error: unknown }

const fake = vi.hoisted(() => ({
  userId: null as string | null,
  queries: [] as Call[][],
  respond: (_calls: Call[]): Response | Promise<Response> => ({ data: null, error: null }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({
    from: (table: string) => fakeQuery(['from', table]),
    rpc: (fn: string, args?: object) => fakeQuery(['rpc', fn, args]),
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

/** Builder giả: ghi lại chuỗi lệnh, khi được await thì trả kết quả của fake.respond */
function fakeQuery(first: Call) {
  const calls: Call[] = [first]
  fake.queries.push(calls)
  const builder: object = new Proxy(
    {},
    {
      get: (_, method) =>
        method === 'then'
          ? (resolve: (value: Response) => void, reject: (error: unknown) => void) =>
              Promise.resolve(fake.respond(calls)).then(resolve, reject)
          : (...args: unknown[]) => {
              calls.push([String(method), ...args])
              return builder
            },
    },
  )
  return builder
}

const USER = 'u1'
const TIME = '2026-09-28T03:00:00.000Z'
const GUEST_KEY = 'reading-history-guest'

const ok = (data: unknown): Response => ({ data, error: null })
const rpcCalls = (fn: string) =>
  fake.queries.filter(([[kind, name]]) => kind === 'rpc' && name === fn)
/** Giá trị của bộ lọc .in() trong một truy vấn */
const inValues = (calls: Call[]) => calls.find(([method]) => method === 'in')![2] as string[]
/** Chờ các lượt await đang dở chạy hết */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const guestEntry = {
  slug: 'mua-ha',
  chapter: 3,
  chapterTitle: 'Chương 3',
  progress: 0.5,
  readAt: TIME,
}

/** Dòng reading_history mà save_reading_progress trả về */
const historyRow = (chapter: number, progress: number) => ({
  user_id: USER,
  story_id: 's1',
  chapter_number: chapter,
  chapter_title: `Chương ${chapter}`,
  progress,
  read_at: TIME,
})

/** Dòng của view story_cards (đủ cột cho toStory) */
const card = (id: string) => ({
  id,
  slug: `truyen-${id}`,
  title: `Truyện ${id}`,
  owner_id: 'tac-gia',
  author_name: 'Tác giả',
  genres: [],
  status: 'ongoing',
  description: '',
  cover_path: null,
  chapter_count: 3,
  view_count: 0,
  rating_avg: 0,
  rating_count: 0,
  first_chapter_number: 1,
  latest_chapter_number: 3,
  latest_chapter_title: 'Chương 3',
  visibility: 'published',
  created_at: TIME,
  updated_at: TIME,
})

beforeEach(() => {
  localStorage.clear()
  fake.userId = null
  fake.queries = []
  fake.respond = () => ok(null)
})

test('ghi chỗ đọc: lần sau chỉ gửi khi lần trước xong, nên lần gọi sau cùng thắng', async () => {
  fake.userId = USER
  const pending: ((response: Response) => void)[] = []
  fake.respond = () => new Promise((resolve) => pending.push(resolve))

  // Rời chương 5 (lưu vị trí cuộn) rồi mở ngay chương 6, như useReadingTracker
  const leave = saveReadingProgress({
    slug: 'mua-ha',
    chapter: 5,
    chapterTitle: 'Chương 5',
    progress: 0.9,
  })
  const open = saveReadingProgress({ slug: 'mua-ha', chapter: 6, chapterTitle: 'Chương 6' })
  await settle()
  expect(rpcCalls('save_reading_progress')).toHaveLength(1)
  expect(rpcCalls('save_reading_progress')[0][0][2]).toMatchObject({ p_chapter: 5 })

  pending[0](ok(historyRow(5, 0.9)))
  await expect(leave).resolves.toMatchObject({ chapter: 5, progress: 0.9 })
  await settle()
  expect(rpcCalls('save_reading_progress')).toHaveLength(2)
  expect(rpcCalls('save_reading_progress')[1][0][2]).toEqual({
    p_slug: 'mua-ha',
    p_chapter: 6,
    p_chapter_title: 'Chương 6',
    p_progress: undefined,
  })

  pending[1](ok(historyRow(6, 0)))
  await expect(open).resolves.toMatchObject({ slug: 'mua-ha', chapter: 6, progress: 0 })
})

test('ghi chỗ đọc: lần trước lỗi thì lần sau vẫn chạy', async () => {
  fake.userId = USER
  const error = { code: '57014', message: 'canceling statement due to statement timeout' }
  const responses = [{ data: null, error }, ok(historyRow(6, 0))]
  fake.respond = () => responses.shift()!

  const first = saveReadingProgress({ slug: 'mua-ha', chapter: 5, chapterTitle: 'Chương 5' })
  const second = saveReadingProgress({ slug: 'mua-ha', chapter: 6, chapterTitle: 'Chương 6' })
  await expect(first).rejects.toBe(error)
  await expect(second).resolves.toMatchObject({ chapter: 6 })
})

test('ghi chỗ đọc: khách lưu trên máy, không gọi máy chủ', async () => {
  await saveReadingProgress({ slug: 'mua-ha', chapter: 2, chapterTitle: 'Chương 2' })
  expect(loadGuestHistory()).toMatchObject([{ slug: 'mua-ha', chapter: 2, progress: 0 }])
  expect(fake.queries).toEqual([])
})

test('lịch sử khách: bỏ dòng mà merge_guest_history không đọc được, giữ dòng đúng', () => {
  localStorage.setItem(
    GUEST_KEY,
    JSON.stringify([
      guestEntry,
      { ...guestEntry, slug: 'so-qua-lon', chapter: 1e12 },
      { ...guestEntry, slug: 'so-khong', chapter: 0 },
      { ...guestEntry, slug: 'so-le', chapter: 2.5 },
      { ...guestEntry, slug: 'tien-do', progress: 1e300 },
      { ...guestEntry, slug: 'ngay-so', readAt: '1' },
      { ...guestEntry, slug: 'ngay-30-2', readAt: '2026-02-30T00:00:00.000Z' },
      { ...guestEntry, slug: 'ngay-dang-chu', readAt: new Date(TIME).toString() },
      { ...guestEntry, slug: 'nam-0', readAt: '0000-01-01T00:00:00.000Z' },
      null,
    ]),
  )
  expect(loadGuestHistory()).toEqual([guestEntry])
})

test('gộp lịch sử khách: lỗi dữ liệu thì bỏ bản trên máy, tủ truyện vẫn chạy', async () => {
  fake.userId = USER
  localStorage.setItem(GUEST_KEY, JSON.stringify([guestEntry]))
  fake.respond = ([[, fn]]) =>
    fn === 'merge_guest_history'
      ? { data: null, error: { code: '22003', message: 'value out of range for type integer' } }
      : ok(2)

  await expect(getLibraryUpdateCount()).resolves.toBe(2)
  expect(rpcCalls('merge_guest_history')[0][0][2]).toEqual({ p_entries: [guestEntry] })
  expect(loadGuestHistory()).toEqual([])
})

test('gộp lịch sử khách: lỗi khác (cổng API, mạng) thì giữ bản trên máy để gộp lại', async () => {
  fake.userId = USER
  localStorage.setItem(GUEST_KEY, JSON.stringify([guestEntry]))
  // Trang lỗi không phải JSON: supabase-js trả lỗi không có code
  const gateway = { message: '<html>502 Bad Gateway</html>' }
  fake.respond = ([[, fn]]) =>
    fn === 'merge_guest_history' ? { data: null, error: gateway } : ok(2)

  await expect(getLibraryUpdateCount()).rejects.toBe(gateway)
  expect(loadGuestHistory()).toEqual([guestEntry])

  fake.respond = () => ok(2)
  await expect(getLibraryUpdateCount()).resolves.toBe(2)
  expect(rpcCalls('merge_guest_history')).toHaveLength(2)
  expect(loadGuestHistory()).toEqual([])
})

test('tủ truyện: theo dõi nhiều truyện thì chia id thành nhiều truy vấn, giữ thứ tự get_library', async () => {
  fake.userId = USER
  const ids = Array.from({ length: 250 }, (_, i) => `id-${249 - i}`)
  fake.respond = (calls) => {
    const [[kind, name]] = calls
    if (kind === 'rpc') {
      return ok(
        ids.map((id) => ({
          story_id: id,
          slug: `truyen-${id}`,
          followed_at: TIME,
          seen_chapter: 3,
          new_chapters: 0,
        })),
      )
    }
    const values = inValues(calls)
    if (name === 'story_cards') return ok(values.map(card))
    // Chỉ truyện id-7 đã đọc tới chương 2
    return ok(
      values
        .filter((id) => id === 'id-7')
        .map((id) => ({ ...historyRow(2, 0.4), story_id: id, chapter_title: 'Chương 2' })),
    )
  }

  const items = await getLibrary()
  expect(items.map((item) => item.story.id)).toEqual(ids)
  expect(items.find((item) => item.story.id === 'id-7')?.progress).toEqual({
    slug: 'truyen-id-7',
    chapter: 2,
    chapterTitle: 'Chương 2',
    progress: 0.4,
    readAt: TIME,
  })
  expect(items.filter((item) => item.progress)).toHaveLength(1)

  const chunkSizes = (table: string) =>
    fake.queries.filter(([[, name]]) => name === table).map((calls) => inValues(calls).length)
  expect(chunkSizes('story_cards')).toEqual([100, 100, 50])
  expect(chunkSizes('reading_history')).toEqual([100, 100, 50])
})
