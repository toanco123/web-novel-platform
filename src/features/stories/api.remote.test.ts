// Bản Supabase (api.remote.ts) chạy trên client giả mô phỏng các lệnh PostgREST mà nó dùng: kiểm
// tra kẹp số trang của danh sách có bộ lọc giống paginate() của bản giả, kể cả số trang quá lớn gõ
// tay trên URL. Truy vấn trên database thật (view story_cards, RLS) do lượt test tích hợp kiểm tra.
import { paginate } from '@/lib/pagination'
import { browseStories } from './api.remote'
import { BROWSE_PER_PAGE } from './shared'

/** Thẻ truyện rút gọn: test này chỉ kiểm tra phân trang */
type Card = { id: string; slug: string }
type Call = [method: string, args: unknown[]]

const fake = vi.hoisted(() => ({ rows: [] as Card[], queries: [] as Call[][] }))

vi.mock('./cards.remote', () => ({
  publicStoryCards: (options?: { count?: 'exact' }) => fakeQuery(options?.count === 'exact'),
  toStory: (row: Card) => row,
}))

/** Builder giả: ghi lại chuỗi lệnh (order, range...), trả kết quả khi được await */
function fakeQuery(exactCount: boolean) {
  const calls: Call[] = []
  fake.queries.push(calls)
  const builder: object = new Proxy(
    {},
    {
      get: (_, method) =>
        method === 'then'
          ? (resolve: (value: unknown) => void) => resolve(respond(calls, exactCount))
          : (...args: unknown[]) => {
              calls.push([String(method), args])
              return builder
            },
    },
  )
  return builder
}

const failure = (code: string, message: string) => ({
  data: null,
  count: null,
  error: { code, message },
})

/** Kết quả PostgREST trả về cho chuỗi lệnh đã ghi, chạy trên fake.rows (đã xếp sẵn thứ tự) */
function respond(calls: Call[], exactCount: boolean) {
  const total = fake.rows.length
  let rows = fake.rows
  for (const [method, args] of calls) {
    if (method === 'order') continue
    if (method !== 'range') throw new Error(`Lệnh chưa mô phỏng: ${method}`)
    const [from, to] = args as [number, number]
    // offset/limit phải là số nguyên đọc được và nằm trong bigint (Infinity, 2.4e+26 thì không)
    if (![from, to].every(Number.isSafeInteger)) {
      return failure('22003', `Không đọc được offset=${from}`)
    }
    // Có đếm tổng mà vị trí bắt đầu vượt quá tổng số dòng: 416, không kèm tổng
    if (exactCount && from > total) return failure('PGRST103', 'Range not satisfiable')
    rows = rows.slice(from, to + 1)
  }
  return { data: rows, count: exactCount ? total : null, error: null }
}

const cards = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `id-${i + 1}`, slug: `truyen-${i + 1}` }))

describe('browseStories', () => {
  beforeEach(() => {
    fake.rows = cards(60) // 3 trang
    fake.queries = []
  })

  test('kẹp số trang giống paginate(), kể cả ?trang= quá lớn (Infinity, 1e18...)', async () => {
    for (const count of [60, 0]) {
      fake.rows = cards(count)
      for (const page of [1, 2, 3, 4, 99, 0, -2, 2.7, NaN, Infinity, 1e16, 1e18, 1e25]) {
        expect(await browseStories({ page })).toEqual(paginate(fake.rows, page, BROWSE_PER_PAGE))
      }
    }
  })

  test('số trang quá lớn không gửi lên máy chủ: đọc trang 1 để biết tổng rồi đọc trang cuối', async () => {
    expect(await browseStories({ page: Infinity })).toMatchObject({ page: 3, pageCount: 3 })
    const ranges = fake.queries.map((calls) => calls.find(([method]) => method === 'range')?.[1])
    expect(ranges).toEqual([
      [0, 23],
      [48, 71],
    ])
  })
})
