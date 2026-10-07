// Bản Supabase (api.remote.ts) chạy trên client giả: đúng bảng, chỉ gửi cột được cấp quyền, đổi dòng
// trả về sang BlockedUser và map mã lỗi. RLS (ẩn bình luận, chỉ thấy dòng của mình) do migration
// 20261002021134_user_blocks.sql kiểm tra trên database thật.
import { AuthError } from '@/features/auth/api'
import { blockUser, getBlockedUsers, unblockUser } from './api.remote'

const fake = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  userId: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ supabase: null, db: () => ({ from: fake.from }) }))
vi.mock('@/features/auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api')>()),
  requireUserId: fake.userId,
}))

beforeEach(() => {
  for (const fn of Object.values(fake)) fn.mockReset()
  fake.userId.mockResolvedValue('toi')
  fake.from.mockReturnValue({ insert: fake.insert, delete: fake.remove, select: fake.select })
  fake.insert.mockResolvedValue({ data: null, error: null })
  // delete().eq().eq(): lần eq thứ hai trả kết quả
  fake.remove.mockReturnValue({ eq: fake.eq })
  fake.eq.mockReturnValueOnce({ eq: fake.eq }).mockResolvedValueOnce({ data: null, error: null })
  fake.select.mockReturnValue({ order: fake.order })
})

test('chặn: chỉ gửi blocked_id (blocker_id do DB đặt), bấm trùng thì coi như xong', async () => {
  await blockUser('linh')
  expect(fake.from).toHaveBeenCalledWith('user_blocks')
  expect(fake.insert).toHaveBeenCalledWith({ blocked_id: 'linh' })

  fake.insert.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
  await expect(blockUser('linh')).resolves.toBeUndefined()
})

test('chặn: tự chặn mình (23514) thành lời báo, lỗi khác giữ nguyên', async () => {
  fake.insert.mockResolvedValue({ data: null, error: { code: '23514', message: 'check' } })
  await expect(blockUser('toi')).rejects.toThrow('Bạn không thể chặn chính mình.')
  const error = { code: '42501', message: 'permission denied' }
  fake.insert.mockResolvedValue({ data: null, error })
  await expect(blockUser('linh')).rejects.toBe(error)
})

test('chặn cần đăng nhập', async () => {
  fake.userId.mockRejectedValue(new AuthError('unauthenticated', 'Bạn cần đăng nhập'))
  await expect(blockUser('linh')).rejects.toBeInstanceOf(AuthError)
  expect(fake.insert).not.toHaveBeenCalled()
})

test('bỏ chặn: xóa đúng dòng của mình', async () => {
  await unblockUser('linh')
  expect(fake.eq).toHaveBeenNthCalledWith(1, 'blocker_id', 'toi')
  expect(fake.eq).toHaveBeenNthCalledWith(2, 'blocked_id', 'linh')
})

test('danh sách: nhúng hồ sơ người bị chặn, chặn gần nhất trước', async () => {
  fake.order.mockResolvedValue({
    data: [
      {
        created_at: '2026-10-07T01:00:00Z',
        user: { id: 'linh', display_name: 'Linh', avatar_url: null },
      },
    ],
    error: null,
  })
  expect(await getBlockedUsers()).toEqual([
    {
      user: { id: 'linh', displayName: 'Linh', avatarUrl: null },
      blockedAt: '2026-10-07T01:00:00Z',
    },
  ])
  expect(fake.select).toHaveBeenCalledWith(
    expect.stringContaining('profiles!user_blocks_blocked_id_fkey'),
  )
  expect(fake.order).toHaveBeenCalledWith('created_at', { ascending: false })
})
