// Bản Supabase (api.remote.ts) chạy trên client giả: đúng bảng/RPC, chỉ gửi các cột được cấp quyền,
// đổi dòng trả về sang ChapterReport và map mã lỗi. RLS và việc gộp báo lỗi trùng trên database thật
// do lượt test tích hợp kiểm tra.
import { AuthError } from '@/features/auth/api'
import { signInAs } from '@/test/helpers'
import { reportChapter, sendContactMessage } from './api.remote'

const fake = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), rpc: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({ from: fake.from, rpc: fake.rpc }),
}))

beforeEach(() => {
  localStorage.clear()
  for (const fn of Object.values(fake)) fn.mockReset()
  // insert trả thẳng Promise: nếu api gọi thêm .select() thì test sẽ lỗi
  fake.from.mockReturnValue({ insert: fake.insert })
  fake.insert.mockResolvedValue({ data: null, error: null })
})

const contact = {
  name: 'Lan',
  email: 'lan@gmail.com',
  topic: 'bug',
  message: 'Trang tìm kiếm bị lỗi.',
} as const

test('liên hệ: khách gửi được, chỉ gửi các cột được cấp quyền và không đọc lại', async () => {
  const input = { ...contact, user_id: 'nguoi-khac' }
  await expect(sendContactMessage(input)).resolves.toBeUndefined()
  expect(fake.from).toHaveBeenCalledWith('contact_messages')
  expect(fake.insert).toHaveBeenCalledWith(contact)
})

test('liên hệ: lỗi từ database giữ nguyên', async () => {
  const error = { code: '23514', message: 'violates check constraint' }
  fake.insert.mockResolvedValue({ data: null, error })
  await expect(sendContactMessage(contact)).rejects.toBe(error)
})

const report = { slug: 'mua-ha', chapter: 2, reason: 'typo', note: '  Sai chữ "gió"\n' } as const

test('báo lỗi: chưa đăng nhập thì báo AuthError, không gọi máy chủ', async () => {
  await expect(reportChapter(report)).rejects.toBeInstanceOf(AuthError)
  await expect(reportChapter(report)).rejects.toMatchObject({ code: 'unauthenticated' })
  expect(fake.rpc).not.toHaveBeenCalled()
})

test('báo lỗi: gọi report_chapter với ghi chú đã bỏ khoảng trắng, trả về ChapterReport', async () => {
  signInAs('demo')
  const row = {
    id: 'r1',
    story_id: 's1',
    chapter_number: 2,
    reporter_id: 'demo',
    reason: 'typo',
    note: 'Sai chữ "gió"',
    status: 'open',
    created_at: '2026-09-28T05:00:00+00:00',
    resolved_at: null,
  }
  fake.rpc.mockResolvedValue({ data: row, error: null })

  expect(await reportChapter(report)).toEqual({
    id: 'r1',
    storySlug: 'mua-ha',
    chapterNumber: 2,
    reason: 'typo',
    note: 'Sai chữ "gió"',
    reporter: { id: 'demo', displayName: 'Bạn đọc Demo' },
    status: 'open',
    createdAt: '2026-09-28T05:00:00+00:00',
  })
  expect(fake.rpc).toHaveBeenCalledWith('report_chapter', {
    p_slug: 'mua-ha',
    p_chapter: 2,
    p_reason: 'typo',
    p_note: 'Sai chữ "gió"',
  })
})

test.each([
  ['không thấy truyện', { code: 'P0001', message: 'not_found' }, 'unknown'],
  ['RLS chặn (chương chưa công khai)', { code: '42501', message: 'row-level security' }, 'unknown'],
  ['RPC báo chưa đăng nhập', { code: 'P0001', message: 'unauthenticated' }, 'unauthenticated'],
])('báo lỗi: %s → AuthError để hộp thoại hiện lời báo', async (_, error, code) => {
  signInAs('demo')
  fake.rpc.mockResolvedValue({ data: null, error })
  const thrown = await reportChapter(report).catch((e: unknown) => e)
  expect(thrown).toBeInstanceOf(AuthError)
  expect(thrown).toMatchObject({ code })
})

test('báo lỗi: lỗi khác giữ nguyên', async () => {
  signInAs('demo')
  const error = { code: '23514', message: 'violates check constraint' }
  fake.rpc.mockResolvedValue({ data: null, error })
  await expect(reportChapter(report)).rejects.toBe(error)
})

test('liên hệ: DB báo rate_limited thì đổi sang AuthError có lời báo', async () => {
  fake.insert.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'rate_limited' } })
  await expect(sendContactMessage(contact)).rejects.toMatchObject({
    code: 'rate_limited',
    message: 'Bạn thao tác hơi nhanh. Đợi một lát rồi thử lại.',
  })
})
