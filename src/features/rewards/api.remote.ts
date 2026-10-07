// Điểm danh và phiếu đề cử trên Supabase. Bảng, RPC và luật ở migration
// 20261007082322_checkin_and_votes.sql; mục 3–6 documents/thiet-ke-database.md. Số dư chỉ đổi qua
// RPC (private.ledger_post), client chỉ đọc sổ của mình.
import type { PostgrestError } from '@supabase/supabase-js'
import { requireUserId, unauthenticated } from '@/features/auth/api'
import { businessCode, unwrap } from '@/lib/dbError'
import { loadPage } from '@/lib/dbPage'
import { db } from '@/lib/supabase'
import type { Page } from '@/types/page'
import {
  type CheckInResult,
  isRewardErrorCode,
  type LedgerEntry,
  RewardError,
  type RewardStatus,
  type StoryVoteSummary,
  TICKET_HISTORY_PAGE_SIZE,
  type VoteResult,
} from './shared'

/** Mã lỗi của RPC → RewardError / AuthError; lỗi khác giữ nguyên */
function rewardError(error: PostgrestError) {
  const code = businessCode(error)
  if (code === 'unauthenticated') return unauthenticated()
  // ledger_post báo chung cho mọi loại tài sản; vote_story đã kiểm số dư trước nên hiếm gặp
  if (code === 'insufficient_balance') return new RewardError('insufficient_tickets')
  return code && isRewardErrorCode(code) ? new RewardError(code) : null
}

/** jsonb trả về số dạng number hoặc chuỗi (bigint): đổi hết sang number */
const num = (value: unknown) => Number(value ?? 0)

export async function getRewardStatus(): Promise<RewardStatus> {
  await requireUserId()
  const data = unwrap(await db().rpc('reward_status'), rewardError) as Record<string, unknown>
  return {
    balance: num(data.balance),
    today: String(data.today),
    checkedInToday: data.checkedInToday === true,
    streak: num(data.streak),
    nextReward: num(data.nextReward),
  }
}

export async function checkIn(): Promise<CheckInResult> {
  await requireUserId()
  const data = unwrap(await db().rpc('daily_checkin'), rewardError) as Record<string, unknown>
  return { reward: num(data.reward), streak: num(data.streak), balance: num(data.balance) }
}

/** Sổ phiếu của mình (RLS), mới nhất trước; truyện đã ẩn hoặc xóa thì story = null */
export async function getTicketHistory({ page = 1 }: { page?: number } = {}): Promise<
  Page<LedgerEntry>
> {
  await requireUserId()
  const result = await loadPage(page, TICKET_HISTORY_PAGE_SIZE, (from, to) =>
    db()
      .from('wallet_ledger')
      .select('id, amount, reason, balance_after, created_at, story:stories(slug, title)', {
        count: 'exact',
      })
      .eq('currency', 'ticket')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )
  return {
    ...result,
    items: result.items.map((row) => ({
      id: String(row.id),
      amount: row.amount,
      reason: row.reason,
      story: row.story ? { slug: row.story.slug, title: row.story.title } : null,
      balanceAfter: row.balance_after,
      createdAt: row.created_at,
    })),
  }
}

export async function getStoryVoteSummary(slug: string): Promise<StoryVoteSummary> {
  const data = unwrap(
    await db().rpc('story_vote_summary', { p_slug: slug }),
    rewardError,
  ) as Record<string, unknown>
  return { total: num(data.total), week: num(data.week), mine: num(data.mine) }
}

export async function voteStory(slug: string, amount: number): Promise<VoteResult> {
  await requireUserId()
  const data = unwrap(
    await db().rpc('vote_story', { p_slug: slug, p_amount: amount }),
    rewardError,
  ) as Record<string, unknown>
  return { balance: num(data.balance), total: num(data.total) }
}
