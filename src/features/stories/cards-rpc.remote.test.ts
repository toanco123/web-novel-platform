// Các danh sách lấy thẻ truyện thẳng từ RPC (plan-toi-uu-tai-trang-dot-3.md mục 2): một request,
// đọc cột `card`, giữ thứ tự của RPC. Quyền xem (truyện nháp không hiện) do ca kiểm tra SQL lo.
import {
  getEditorPicks,
  getRanking,
  getRelatedStories,
  getSearchSuggestions,
  searchStories,
} from './api.remote'

type Call = [method: string, ...args: unknown[]]

const fake = vi.hoisted(() => ({
  queries: [] as Call[][],
  respond: (_calls: Call[]): unknown => ({ data: [], error: null }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({
    rpc: (fn: string, args: unknown) => fakeQuery(['rpc', fn, args]),
    from: (table: string) => fakeQuery(['from', table]),
  }),
}))
vi.mock('@/lib/imageUpload', () => ({
  publicImageUrl: (_bucket: string, path: string) => `https://cdn.test/${path}`,
}))

function fakeQuery(first: Call) {
  const calls: Call[] = [first]
  fake.queries.push(calls)
  const builder: object = new Proxy(
    {},
    {
      get: (_, method) =>
        method === 'then'
          ? (resolve: (value: unknown) => void) => resolve(fake.respond(calls))
          : (...args: unknown[]) => {
              calls.push([String(method), ...args])
              return builder
            },
    },
  )
  return builder
}

/** Một dòng story_cards tối thiểu */
const card = (slug: string, thumb = false) => ({
  id: `id-${slug}`,
  slug,
  title: slug,
  description: 'Mô tả',
  status: 'ongoing',
  visibility: 'published',
  owner_id: '11111111-1111-4111-8111-111111111111',
  author_name: 'Tác giả',
  author_key: null,
  cover_path: 'u/anh.webp',
  cover_thumb_path: thumb ? 'u/anh-thumb.webp' : null,
  genres: [],
  chapter_count: 3,
  first_chapter_number: 1,
  latest_chapter_number: 3,
  latest_chapter_title: 'Ba',
  view_count: 10,
  rating_count: 0,
  rating_avg: 0,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-07T00:00:00Z',
  next_chapter_number: null,
  next_chapter_at: null,
})

const ok = (data: unknown, count?: number) => ({ data, error: null, count: count ?? null })

beforeEach(() => {
  fake.queries = []
  fake.respond = () => ok([])
})

test('xếp hạng: một RPC story_ranking_cards, giữ thứ tự và giá trị', async () => {
  fake.respond = () =>
    ok([
      { value: 9, card: card('b') },
      { value: 4, card: card('a', true) },
    ])
  const ranked = await getRanking({ by: 'votes', period: 'week', limit: 10 })
  expect(ranked.map((r) => [r.story.slug, r.value])).toEqual([
    ['b', 9],
    ['a', 4],
  ])
  expect(ranked[1].story.coverThumbUrl).toBe('https://cdn.test/u/anh-thumb.webp')
  expect(ranked[0].story.coverThumbUrl).toBeNull()
  expect(fake.queries).toEqual([
    [['rpc', 'story_ranking_cards', { p_by: 'votes', p_period: 'week', p_limit: 10 }]],
  ])
})

test('truyện liên quan, đề cử trang chủ: một RPC, đọc thẻ từ kết quả', async () => {
  fake.respond = () => ok([{ card: card('x') }, { card: card('y') }])
  expect((await getRelatedStories('goc')).map((s) => s.slug)).toEqual(['x', 'y'])
  expect(fake.queries).toHaveLength(1)

  fake.queries = []
  fake.respond = () => ok([card('p'), card('q')])
  expect((await getEditorPicks()).map((s) => s.slug)).toEqual(['p', 'q'])
  expect(fake.queries).toEqual([[['rpc', 'curated_story_cards', { p_list: 'editor_pick' }]]])
})

test('tìm kiếm và gợi ý: thẻ đi kèm kết quả tìm, không gọi thêm story_cards', async () => {
  fake.respond = (calls) =>
    calls[0][0] === 'rpc'
      ? ok([{ story_id: 'id-m', score: 4, view_count: 1, card: card('mong') }], 1)
      : ok([])
  const result = await searchStories('mộng')
  expect(result.items.map((s) => s.slug)).toEqual(['mong'])
  expect(fake.queries.map(([[kind, name]]) => `${kind}:${name}`).sort()).toEqual([
    'from:genre_cards',
    'rpc:search_story_cards',
  ])

  fake.queries = []
  expect((await getSearchSuggestions('mộng')).map((s) => s.slug)).toEqual(['mong'])
  expect(fake.queries.map(([[kind, name]]) => `${kind}:${name}`)).toEqual([
    'rpc:search_story_cards',
  ])
})
