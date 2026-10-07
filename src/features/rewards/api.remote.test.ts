// Bản Supabase (api.remote.ts) chạy trên client giả: đúng RPC / bảng, đổi jsonb sang kiểu của app
// (bigint có thể về dạng chuỗi) và map mã lỗi. Luật và RLS trên database thật do ca kiểm tra SQL
// (supabase/checks/rls_and_rules.sql) lo.
import { signInAs } from '@/test/helpers'
import {
  checkIn,
  getRewardStatus,
  getStoryVoteSummary,
  getTicketHistory,
  voteStory,
} from './api.remote'
import { RewardError } from './shared'

const fake = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), calls: [] as unknown[][] }))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({ rpc: fake.rpc, from: fake.from }),
}))

/** Truy vấn PostgREST giả: ghi lại mọi lệnh nối chuỗi, `await` thì trả `result` */
function query(result: unknown) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'range']) {
    builder[method] = (...args: unknown[]) => {
      fake.calls.push([method, ...args])
      return builder
    }
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result)
  return builder
}

const ok = (data: unknown) => ({ data, error: null })
const fail = (message: string) => ({
  data: null,
  error: { code: 'P0001', message, details: '', hint: '' },
})

beforeEach(() => {
  localStorage.clear()
  fake.rpc.mockReset()
  fake.from.mockReset()
  fake.calls = []
  signInAs('demo')
})

test('reward_status: đổi số dạng chuỗi sang number', async () => {
  fake.rpc.mockResolvedValue(
    ok({ balance: '12', today: '2026-10-07', checkedInToday: false, streak: 3, nextReward: 1 }),
  )
  expect(await getRewardStatus()).toEqual({
    balance: 12,
    today: '2026-10-07',
    checkedInToday: false,
    streak: 3,
    nextReward: 1,
  })
  expect(fake.rpc).toHaveBeenCalledWith('reward_status')
})

test('daily_checkin: trả phiếu nhận được; điểm danh lại trong ngày thành RewardError', async () => {
  fake.rpc.mockResolvedValueOnce(ok({ reward: 3, streak: 7, balance: 15 }))
  expect(await checkIn()).toEqual({ reward: 3, streak: 7, balance: 15 })
  expect(fake.rpc).toHaveBeenCalledWith('daily_checkin')

  fake.rpc.mockResolvedValueOnce(fail('already_checked_in'))
  const error = await checkIn().catch((e: unknown) => e)
  expect(error).toBeInstanceOf(RewardError)
  expect(error).toMatchObject({ code: 'already_checked_in' })
})

test('chưa đăng nhập thì báo unauthenticated, không gọi máy chủ', async () => {
  localStorage.removeItem('mock-auth-session')
  await expect(checkIn()).rejects.toMatchObject({ code: 'unauthenticated' })
  await expect(voteStory('mua-ha', 1)).rejects.toMatchObject({ code: 'unauthenticated' })
  expect(fake.rpc).not.toHaveBeenCalled()
})

test('vote_story: gửi slug và số phiếu; map các mã lỗi', async () => {
  fake.rpc.mockResolvedValueOnce(ok({ balance: 7, total: '128' }))
  expect(await voteStory('mua-ha', 5)).toEqual({ balance: 7, total: 128 })
  expect(fake.rpc).toHaveBeenCalledWith('vote_story', { p_slug: 'mua-ha', p_amount: 5 })

  for (const code of ['own_story', 'account_too_new', 'insufficient_tickets', 'not_found']) {
    fake.rpc.mockResolvedValueOnce(fail(code))
    await expect(voteStory('mua-ha', 1)).rejects.toMatchObject({ name: 'RewardError', code })
  }
  // ledger_post báo chung cho mọi loại tài sản
  fake.rpc.mockResolvedValueOnce(fail('insufficient_balance'))
  await expect(voteStory('mua-ha', 1)).rejects.toMatchObject({ code: 'insufficient_tickets' })
})

test('story_vote_summary: khách cũng gọi được', async () => {
  localStorage.removeItem('mock-auth-session')
  fake.rpc.mockResolvedValue(ok({ total: '40', week: 12, mine: 0 }))
  expect(await getStoryVoteSummary('mua-ha')).toEqual({ total: 40, week: 12, mine: 0 })
  expect(fake.rpc).toHaveBeenCalledWith('story_vote_summary', { p_slug: 'mua-ha' })
})

test('lịch sử phiếu: đọc wallet_ledger mới nhất trước, có phân trang và tên truyện', async () => {
  fake.from.mockReturnValue(
    query({
      data: [
        {
          id: 9,
          amount: -5,
          reason: 'vote',
          balance_after: 12,
          created_at: '2026-10-07T10:00:00Z',
          story: { slug: 'mua-ha', title: 'Mùa Hạ' },
        },
        {
          id: 8,
          amount: 1,
          reason: 'checkin',
          balance_after: 17,
          created_at: '2026-10-07T01:00:00Z',
          story: null,
        },
      ],
      count: 22,
      error: null,
    }),
  )
  const page = await getTicketHistory({ page: 2 })
  expect(fake.from).toHaveBeenCalledWith('wallet_ledger')
  expect(fake.calls).toContainEqual(['eq', 'currency', 'ticket'])
  expect(fake.calls).toContainEqual(['order', 'created_at', { ascending: false }])
  expect(fake.calls).toContainEqual(['range', 20, 39])
  expect(page).toMatchObject({ total: 22, page: 2, pageCount: 2 })
  expect(page.items).toEqual([
    {
      id: '9',
      amount: -5,
      reason: 'vote',
      story: { slug: 'mua-ha', title: 'Mùa Hạ' },
      balanceAfter: 12,
      createdAt: '2026-10-07T10:00:00Z',
    },
    {
      id: '8',
      amount: 1,
      reason: 'checkin',
      story: null,
      balanceAfter: 17,
      createdAt: '2026-10-07T01:00:00Z',
    },
  ])
})
