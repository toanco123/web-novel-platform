// Điểm danh và phiếu đề cử giả (localStorage, mocks/activity.ts): dùng cho test tự động và khi chạy
// không có Supabase (xem api.ts). Luật giống DB (plan documents/plan-diem-danh-va-de-cu.md mục 1, 2).
import { getSession, requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { paginate } from '@/lib/pagination'
import {
  loadCheckins,
  loadLedger,
  loadVotes,
  saveCheckins,
  saveLedger,
  saveVotes,
  type StoredLedgerEntry,
  storyVoteCount,
} from '@/mocks/activity'
import { findStory } from '@/mocks/catalog'
import { loadUsers } from '@/mocks/users'
import type { Page } from '@/types/page'
import {
  type CheckInResult,
  type LedgerEntry,
  previousDay,
  RewardError,
  rewardFor,
  type RewardStatus,
  type StoryVoteSummary,
  TICKET_HISTORY_PAGE_SIZE,
  vnDay,
  VOTE_MAX_AMOUNT,
  VOTE_MIN_ACCOUNT_AGE_DAYS,
  type VoteResult,
} from './shared'

const balanceOf = (userId: string) => loadLedger(userId)[0]?.balanceAfter ?? 0

/** Cộng / trừ phiếu và ghi sổ (như private.ledger_post): số dư không bao giờ âm */
function post(userId: string, amount: number, reason: StoredLedgerEntry['reason'], slug?: string) {
  const ledger = loadLedger(userId)
  const balance = (ledger[0]?.balanceAfter ?? 0) + amount
  if (balance < 0) throw new RewardError('insufficient_tickets')
  const entry: StoredLedgerEntry = {
    id: `${Date.now()}-${ledger.length}`,
    amount,
    reason,
    storySlug: slug ?? null,
    balanceAfter: balance,
    createdAt: new Date().toISOString(),
  }
  saveLedger(userId, [entry, ...ledger])
  return balance
}

function statusOf(userId: string): RewardStatus {
  const today = vnDay()
  const last = loadCheckins(userId)[0]
  const checkedInToday = last?.day === today
  const streak = last && (checkedInToday || last.day === previousDay(today)) ? last.streak : 0
  return {
    balance: balanceOf(userId),
    today,
    checkedInToday,
    streak,
    nextReward: rewardFor(streak + 1),
  }
}

export async function getRewardStatus(): Promise<RewardStatus> {
  await delay()
  return statusOf((await requireUser()).id)
}

export async function checkIn(): Promise<CheckInResult> {
  await delay()
  const me = (await requireUser()).id
  const today = vnDay()
  const checkins = loadCheckins(me)
  const last = checkins[0]
  if (last?.day === today) throw new RewardError('already_checked_in')
  const streak = last?.day === previousDay(today) ? last.streak + 1 : 1
  const reward = rewardFor(streak)
  saveCheckins(me, [{ day: today, streak, reward }, ...checkins])
  return { reward, streak, balance: post(me, reward, 'checkin') }
}

export async function getTicketHistory({ page = 1 }: { page?: number } = {}): Promise<
  Page<LedgerEntry>
> {
  await delay()
  const ledger = loadLedger((await requireUser()).id)
  const result = paginate(ledger, page, TICKET_HISTORY_PAGE_SIZE)
  return {
    ...result,
    items: result.items.map((e) => {
      const story = e.storySlug ? findStory(e.storySlug) : null
      return {
        id: e.id,
        amount: e.amount,
        reason: e.reason,
        story: story ? { slug: story.slug, title: story.title } : null,
        balanceAfter: e.balanceAfter,
        createdAt: e.createdAt,
      }
    }),
  }
}

/** Truyện đang công khai (có ≥ 1 chương đã xuất bản), không thì not_found */
function publicStory(slug: string) {
  const story = findStory(slug)
  if (!story || story.visibility === 'draft' || story.chapterCount === 0) {
    throw new RewardError('not_found')
  }
  return story
}

export async function getStoryVoteSummary(slug: string): Promise<StoryVoteSummary> {
  await delay()
  publicStory(slug)
  const viewer = await getSession()
  const mine = viewer
    ? loadVotes()
        .filter((v) => v.storySlug === slug && v.userId === viewer.id)
        .reduce((sum, v) => sum + v.amount, 0)
    : 0
  return { total: storyVoteCount(slug), week: storyVoteCount(slug, 7), mine }
}

export async function voteStory(slug: string, amount: number): Promise<VoteResult> {
  await delay()
  const me = (await requireUser()).id
  if (!Number.isInteger(amount) || amount < 1 || amount > VOTE_MAX_AMOUNT) {
    throw new RewardError('invalid_amount')
  }
  const story = publicStory(slug)
  if (story.ownerId === me) throw new RewardError('own_story')
  const createdAt = loadUsers().find((u) => u.id === me)?.createdAt
  if (createdAt && Date.now() - Date.parse(createdAt) < VOTE_MIN_ACCOUNT_AGE_DAYS * 86_400_000) {
    throw new RewardError('account_too_new')
  }
  const balance = post(me, -amount, 'vote', slug)
  saveVotes([
    ...loadVotes(),
    { storySlug: slug, userId: me, amount, createdAt: new Date().toISOString() },
  ])
  return { balance, total: storyVoteCount(slug) }
}
