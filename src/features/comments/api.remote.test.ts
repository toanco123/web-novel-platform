// Bản Supabase (api.remote.ts) chạy trên client giả: đúng bảng/RPC, chỉ gửi các cột được cấp quyền,
// thứ tự sắp xếp và map mã lỗi của thích, sửa, xóa bình luận. RLS và trigger trên database thật do
// supabase/checks/rls_and_rules.sql kiểm tra.
import { signInAs } from '@/test/helpers'
import { deleteComment, editComment, getComments, setCommentLike } from './api.remote'

/** Một truy vấn PostgREST giả: mọi hàm nối chuỗi ghi lại lời gọi, await thì trả `result` */
function query(result: { data: unknown; error: unknown; count?: number }) {
  const calls: [string, unknown[]][] = []
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  }
  for (const name of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'range',
    'maybeSingle',
    'single',
  ]) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, args])
      return chain
    }
  }
  return { chain, calls }
}

const fake = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({ from: fake.from, rpc: fake.rpc }),
}))
vi.mock('@/features/stories/cards.remote', () => ({
  storyIdBySlug: async () => '11111111-1111-4111-8111-111111111111',
}))

const COMMENT_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  localStorage.clear()
  fake.from.mockReset()
  fake.rpc.mockReset()
  signInAs('demo')
})

test('thích: chỉ gửi comment_id; đã thích rồi (trùng khóa) thì không lỗi', async () => {
  const q = query({ data: null, error: { code: '23505', message: 'duplicate key' } })
  fake.from.mockReturnValue(q.chain)
  await expect(setCommentLike(COMMENT_ID, true)).resolves.toBeUndefined()
  expect(fake.from).toHaveBeenCalledWith('comment_likes')
  expect(q.calls).toEqual([['insert', [{ comment_id: COMMENT_ID }]]])
})

test.each([
  [{ code: 'P0001', message: 'own_comment_like' }, 'Bạn không thể tự thích bình luận của mình.'],
  [{ code: 'P0001', message: 'not_found' }, 'Bình luận này không còn nữa.'],
  [{ code: '42501', message: 'row-level security' }, 'Bình luận này không còn nữa.'],
])('thích: lỗi %o thành lời báo cho người dùng', async (error, message) => {
  fake.from.mockReturnValue(query({ data: null, error }).chain)
  await expect(setCommentLike(COMMENT_ID, true)).rejects.toMatchObject({ message })
})

test('thích: vượt 300 lượt / giờ báo rate_limited', async () => {
  fake.from.mockReturnValue(
    query({ data: null, error: { code: 'P0001', message: 'rate_limited' } }).chain,
  )
  await expect(setCommentLike(COMMENT_ID, true)).rejects.toMatchObject({ code: 'rate_limited' })
})

test('bỏ thích: xóa đúng lượt thích của mình', async () => {
  const q = query({ data: null, error: null })
  fake.from.mockReturnValue(q.chain)
  await setCommentLike(COMMENT_ID, false)
  expect(q.calls).toEqual([
    ['delete', []],
    ['eq', ['comment_id', COMMENT_ID]],
    ['eq', ['user_id', 'demo']],
  ])
})

test('sửa: chỉ gửi nội dung đã bỏ khoảng trắng; không có dòng nào thì báo bình luận không còn', async () => {
  const q = query({ data: null, error: null })
  fake.from.mockReturnValue(q.chain)
  await expect(editComment(COMMENT_ID, '  Nội dung mới  ')).rejects.toMatchObject({
    message: 'Bình luận này không còn nữa.',
  })
  expect(fake.from).toHaveBeenCalledWith('comments')
  expect(q.calls[0]).toEqual(['update', [{ content: 'Nội dung mới' }]])
  expect(q.calls[1]).toEqual(['eq', ['id', COMMENT_ID]])
})

test('sửa: trả về bình luận đã sửa kèm lượt thích và nhãn Tác giả', async () => {
  const row = {
    id: COMMENT_ID,
    chapter_number: null,
    content: 'Nội dung mới',
    created_at: '2026-10-08T01:00:00+00:00',
    parent_id: null,
    like_count: 3,
    edited_at: '2026-10-08T02:00:00+00:00',
    story: { slug: 'mua-ha', owner_id: 'demo', author_name: null },
    user: { id: 'demo', display_name: 'Bạn đọc Demo', avatar_url: null },
    my_like: [],
  }
  fake.from.mockReturnValue(query({ data: row, error: null }).chain)
  expect(await editComment(COMMENT_ID, 'Nội dung mới')).toMatchObject({
    content: 'Nội dung mới',
    likeCount: 3,
    likedByMe: false,
    editedAt: '2026-10-08T02:00:00+00:00',
    isAuthor: true,
  })
})

test('xóa: không lọc theo người viết (chủ truyện xóa được, RLS quyết định)', async () => {
  const q = query({ data: null, error: null })
  fake.from.mockReturnValue(q.chain)
  await deleteComment(COMMENT_ID)
  expect(q.calls).toEqual([
    ['delete', []],
    ['eq', ['id', COMMENT_ID]],
  ])
})

test('sắp xếp Nổi bật: theo like_count trước, rồi mới nhất', async () => {
  const q = query({ data: [], error: null, count: 0 })
  fake.rpc.mockReturnValue(q.chain)
  await getComments('mua-ha', { sort: 'top' })
  expect(q.calls.filter(([name]) => name === 'order')).toEqual([
    ['order', ['like_count', { ascending: false }]],
    ['order', ['created_at', { ascending: false }]],
    ['order', ['id', { ascending: false }]],
  ])

  const newest = query({ data: [], error: null, count: 0 })
  fake.rpc.mockReturnValue(newest.chain)
  await getComments('mua-ha')
  expect(newest.calls.filter(([name]) => name === 'order')[0]).toEqual([
    'order',
    ['created_at', { ascending: false }],
  ])
})
