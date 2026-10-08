// Bản Supabase (api.remote.ts) chạy trên client giả mô phỏng các lệnh PostgREST mà nó dùng: kiểm
// tra kẹp số trang (giống paginate() của bản giả), chương trước/sau khi số chương không liền nhau
// và chống đếm trùng lượt đọc. Truy vấn trên database thật (RLS, join với stories) do lượt test
// tích hợp kiểm tra.
import { paginate } from '@/lib/pagination'
import type { Story } from '@/types/story'
import {
  countChaptersFrom,
  getChapter,
  getChapterList,
  getChapterRange,
  recordChapterView,
} from './api.remote'
import { CHAPTERS_PER_PAGE } from './shared'

/** Một dòng của bảng chapters, kèm slug của truyện (thay cho join stories!inner(slug)) */
type Row = {
  slug: string
  number: number
  title: string
  content: string
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
}
type Call = [method: string, args: unknown[]]

const fake = vi.hoisted(() => ({
  rows: [] as Row[],
  story: null as Story | null,
  queries: [] as Call[][],
  getUserId: vi.fn(async (): Promise<string | null> => null),
  rpc: vi.fn(async (_fn: string, _args: object) => ({ error: null as { message: string } | null })),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({ from: (table: string) => fakeQuery(table), rpc: fake.rpc }),
}))
vi.mock('@/features/auth/api', () => ({ getUserId: () => fake.getUserId() }))
vi.mock('@/features/stories/cards.remote', () => ({
  storyBySlug: async (slug: string) => (fake.story?.slug === slug ? fake.story : null),
}))

/** Builder giả: ghi lại chuỗi lệnh (select, eq, order, range...), trả kết quả khi được await */
function fakeQuery(table: string) {
  const calls: Call[] = [['from', [table]]]
  fake.queries.push(calls)
  const builder: object = new Proxy(
    {},
    {
      get: (_, method) =>
        method === 'then'
          ? (resolve: (value: unknown) => void) => resolve(respond(calls))
          : (...args: unknown[]) => {
              calls.push([String(method), args])
              return builder
            },
    },
  )
  return builder
}

/** Kết quả PostgREST trả về cho chuỗi lệnh đã ghi, chạy trên fake.rows */
function respond(calls: Call[]) {
  let rows = [...fake.rows]
  let exactCount = false
  let head = false
  let single = false
  let range: [number, number] | undefined
  let limit = Infinity
  for (const [method, args] of calls) {
    const column = args[0] === 'stories.slug' ? 'slug' : (args[0] as keyof Row)
    const value = args[1]
    switch (method) {
      case 'from':
        if (args[0] !== 'chapters') throw new Error(`Bảng ngoài dự kiến: ${String(args[0])}`)
        break
      case 'select':
        exactCount = (value as { count?: string } | undefined)?.count === 'exact'
        head = (value as { head?: boolean } | undefined)?.head === true
        break
      case 'eq':
        rows = rows.filter((r) => r[column] === value)
        break
      case 'lt':
        rows = rows.filter((r) => (r[column] as number) < (value as number))
        break
      case 'gt':
        rows = rows.filter((r) => (r[column] as number) > (value as number))
        break
      case 'gte':
        rows = rows.filter((r) => (r[column] as number) >= (value as number))
        break
      case 'order': {
        const sign = (value as { ascending: boolean }).ascending ? 1 : -1
        rows.sort((a, b) => sign * ((a[column] as number) - (b[column] as number)))
        break
      }
      case 'limit':
        limit = args[0] as number
        break
      case 'range':
        range = args as [number, number]
        break
      case 'maybeSingle':
        single = true
        break
      default:
        throw new Error(`Lệnh chưa mô phỏng: ${method}`)
    }
  }
  const total = rows.length
  // select(..., { count: 'exact', head: true }): chỉ đếm, không trả dòng
  if (head) return { data: null, count: exactCount ? total : null, error: null }
  // Có đếm tổng mà vị trí bắt đầu vượt quá tổng số dòng: PostgREST trả 416, không kèm tổng
  if (range && exactCount && range[0] > total) {
    return {
      data: null,
      count: null,
      error: { code: 'PGRST103', message: 'Range not satisfiable' },
    }
  }
  if (range) rows = rows.slice(range[0], range[1] + 1)
  rows = rows.slice(0, limit)
  if (!single) return { data: rows, count: exactCount ? total : null, error: null }
  return rows.length > 1
    ? { data: null, count: null, error: { code: 'PGRST116', message: 'Nhiều hơn 1 dòng' } }
    : { data: rows[0] ?? null, count: null, error: null }
}

const chapter = (slug: string, number: number, status: Row['status'] = 'published'): Row => ({
  slug,
  number,
  title: `Chương ${number}`,
  content: `Nội dung chương ${number}`,
  status,
  published_at:
    status === 'published' ? new Date(Date.UTC(2026, 0, 1, number)).toISOString() : null,
  created_at: '2025-12-31T00:00:00.000Z',
})

describe('getChapterList', () => {
  beforeEach(() => {
    fake.rows = [
      ...Array.from({ length: 120 }, (_, i) => chapter('truyen-a', i + 1)),
      chapter('truyen-a', 121, 'draft'),
      chapter('truyen-b', 1),
    ]
    fake.queries = []
  })

  test('chỉ lấy chương đã xuất bản; kẹp số trang và thứ tự giống paginate()', async () => {
    const published = fake.rows
      .filter((r) => r.slug === 'truyen-a' && r.status === 'published')
      .map((r) => ({ number: r.number, title: r.title, createdAt: r.published_at }))
    for (const order of ['asc', 'desc'] as const) {
      const all = order === 'desc' ? [...published].reverse() : published
      for (const page of [1, 2, 3, 4, 99, 0, -2, 2.7, NaN, Infinity]) {
        expect(await getChapterList('truyen-a', { page, order })).toEqual(
          paginate(all, page, CHAPTERS_PER_PAGE),
        )
      }
    }
  })

  test('trang hợp lệ chỉ cần 1 lần gọi; trang vượt quá thì gọi lại trang cuối', async () => {
    await getChapterList('truyen-a', { page: 3 })
    expect(fake.queries).toHaveLength(1)

    fake.queries = []
    expect(await getChapterList('truyen-a', { page: 99 })).toMatchObject({ page: 3, pageCount: 3 })
    expect(fake.queries).toHaveLength(3) // lỗi 416 → trang 1 (biết tổng) → trang 3

    // Vị trí bắt đầu đúng bằng tổng: PostgREST trả trang rỗng (không lỗi) kèm tổng
    fake.rows = fake.rows.filter((r) => r.number <= 100)
    fake.queries = []
    expect(await getChapterList('truyen-a', { page: 3 })).toMatchObject({
      page: 2,
      pageCount: 2,
      total: 100,
      items: expect.arrayContaining([expect.objectContaining({ number: 100 })]),
    })
    expect(fake.queries).toHaveLength(2)
  })

  test('không thấy truyện: trang rỗng như bản giả', async () => {
    const empty = { items: [], total: 0, page: 1, pageCount: 1 }
    expect(await getChapterList('khong-co-truyen-nay')).toEqual(empty)
    expect(await getChapterList('khong-co-truyen-nay', { page: 5, order: 'desc' })).toEqual(empty)
  })
})

const story: Story = {
  id: 'story-a',
  slug: 'truyen-a',
  title: 'Truyện A',
  author: { slug: 'tac-gia-u1', name: 'Tác giả A' },
  genres: [],
  status: 'ongoing',
  description: '',
  coverUrl: null,
  chapterCount: 3,
  viewCount: 0,
  ratingAvg: 0,
  ratingCount: 0,
  firstChapterNumber: 1,
  latestChapter: { number: 7, title: 'Chương 7' },
  nextChapter: null,
  ownerId: 'u1',
  visibility: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T07:00:00.000Z',
}

describe('getChapter', () => {
  beforeEach(() => {
    fake.story = story
    // Chương 2 là bản nháp, bỏ trống số 4–6; truyện B có chương cùng số
    fake.rows = [1, 3, 7].map((n) => chapter('truyen-a', n))
    fake.rows.push(chapter('truyen-a', 2, 'draft'), chapter('truyen-b', 5), chapter('truyen-b', 2))
  })

  test('chương trước/sau bỏ qua chương nháp và số bị bỏ trống', async () => {
    expect(await getChapter('truyen-a', 3)).toEqual({
      story: {
        slug: 'truyen-a',
        title: 'Truyện A',
        author: story.author,
        status: 'ongoing',
        chapterCount: 3,
        coverUrl: null,
        visibility: 'published',
        nextChapter: null,
      },
      number: 3,
      title: 'Chương 3',
      content: 'Nội dung chương 3',
      publishedAt: chapter('truyen-a', 3).published_at,
      prev: { number: 1, title: 'Chương 1' },
      next: { number: 7, title: 'Chương 7' },
    })
    expect(await getChapter('truyen-a', 1)).toMatchObject({ prev: null, next: { number: 3 } })
    expect(await getChapter('truyen-a', 7)).toMatchObject({ prev: { number: 3 }, next: null })
  })

  test('null khi chương là bản nháp, không có số chương đó hoặc không thấy truyện', async () => {
    expect(await getChapter('truyen-a', 2)).toBeNull()
    expect(await getChapter('truyen-a', 5)).toBeNull()
    expect(await getChapter('truyen-b', 5)).toBeNull()
  })
})

describe('recordChapterView', () => {
  beforeEach(() => {
    fake.rpc.mockClear()
    fake.getUserId.mockReset().mockResolvedValue(null)
  })

  test('mỗi người chỉ tính 1 lượt/chương cho mỗi lần tải trang', async () => {
    await Promise.all([recordChapterView('dem-luot', 1), recordChapterView('dem-luot', 1)])
    await recordChapterView('dem-luot', 1)
    expect(fake.rpc).toHaveBeenCalledTimes(1)
    expect(fake.rpc).toHaveBeenCalledWith('record_chapter_view', {
      p_slug: 'dem-luot',
      p_number: 1,
    })

    await recordChapterView('dem-luot', 2)
    fake.getUserId.mockResolvedValue('u2') // người khác (vừa đăng nhập) đọc lại chương 1
    await recordChapterView('dem-luot', 1)
    expect(fake.rpc).toHaveBeenCalledTimes(3)
  })

  test('lỗi không ném ra ngoài; chưa ghi được thì lần sau thử lại', async () => {
    fake.rpc.mockResolvedValueOnce({ error: { message: 'Lỗi máy chủ' } })
    await expect(recordChapterView('thu-lai', 1)).resolves.toBeUndefined()
    fake.rpc.mockRejectedValueOnce(new Error('Mất mạng'))
    await expect(recordChapterView('thu-lai', 1)).resolves.toBeUndefined()
    await recordChapterView('thu-lai', 1) // lần này ghi được
    await recordChapterView('thu-lai', 1)
    expect(fake.rpc).toHaveBeenCalledTimes(3)

    fake.getUserId.mockRejectedValueOnce(new Error('Mất mạng'))
    await expect(recordChapterView('thu-lai', 2)).resolves.toBeUndefined()
    expect(fake.rpc).toHaveBeenCalledTimes(3)
  })
})

describe('getChapterRange và countChaptersFrom', () => {
  beforeEach(() => {
    fake.story = story
    // Chương 5 là bản nháp, bỏ trống số 3 và 6; truyện B có chương cùng số
    fake.rows = [1, 2, 4, 7, 8].map((n) => chapter('truyen-a', n))
    fake.rows.push(chapter('truyen-a', 5, 'draft'), chapter('truyen-b', 4))
  })

  test('chương từ số `from`, trước/sau theo chương đã xuất bản như getChapter', async () => {
    const range = await getChapterRange('truyen-a', 3, 2)
    expect(range.map((c) => [c.prev?.number ?? null, c.number, c.next?.number ?? null])).toEqual([
      [2, 4, 7],
      [4, 7, 8],
    ])
    expect(range[0]).toEqual(await getChapter('truyen-a', 4))
    expect((await getChapterRange('truyen-a', 8, 5)).map((c) => c.next)).toEqual([null])
  })

  test('không thấy truyện, hết chương hoặc count = 0 thì rỗng', async () => {
    expect(await getChapterRange('khong-co', 1, 5)).toEqual([])
    expect(await getChapterRange('truyen-a', 9, 5)).toEqual([])
    expect(await getChapterRange('truyen-a', 1, 0)).toEqual([])
  })

  test('countChaptersFrom chỉ đếm chương đã xuất bản có số ≥ from', async () => {
    expect(await countChaptersFrom('truyen-a', 3)).toBe(3)
    expect(await countChaptersFrom('truyen-a', 9)).toBe(0)
  })
})
