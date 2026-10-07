import { getRanking } from '@/features/stories/api'
import { getStoryStats } from '@/features/studio/api'
import { stories as seedStories } from '@/mocks/stories'
import { draftStory, publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import {
  checkIn,
  getRewardStatus,
  getStoryVoteSummary,
  getTicketHistory,
  RewardError,
  voteStory,
} from './api'

const seedSlug = seedStories[0].slug

/** Giờ máy giả theo giờ Việt Nam (UTC+7), 9 giờ sáng của ngày `day` */
const setDay = (day: string) => vi.setSystemTime(new Date(`${day}T09:00:00+07:00`))

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (e: unknown) => (e instanceof RewardError ? e.code : (e as { code?: string }).code),
  )

/** Điểm danh liên tiếp từ ngày 1 của tháng 10/2026, trả về kết quả từng ngày */
async function checkInDays(count: number, startDay = 1) {
  const results = []
  for (let i = 0; i < count; i++) {
    setDay(`2026-10-${String(startDay + i).padStart(2, '0')}`)
    results.push(await checkIn())
  }
  return results
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  setDay('2026-10-01')
})
afterEach(() => vi.useRealTimers())

describe('điểm danh', () => {
  test('lần đầu +1 phiếu, chuỗi 1; điểm danh lại trong ngày bị chặn', async () => {
    await registerUser()
    expect(await checkIn()).toEqual({ reward: 1, streak: 1, balance: 1 })
    expect(await getRewardStatus()).toMatchObject({
      balance: 1,
      today: '2026-10-01',
      checkedInToday: true,
      streak: 1,
      nextReward: 1,
    })
    expect(await codeOf(checkIn())).toBe('already_checked_in')
  })

  test('ngày tính theo giờ Việt Nam: 23h30 giờ UTC đã là ngày hôm sau', async () => {
    await registerUser()
    await checkIn()
    vi.setSystemTime(new Date('2026-10-01T17:30:00Z'))
    expect((await getRewardStatus()).today).toBe('2026-10-02')
    expect((await checkIn()).streak).toBe(2)
  })

  test('chuỗi tăng mỗi ngày; ngày 7 và 14 được +3 phiếu', async () => {
    await registerUser()
    const rewards = (await checkInDays(14)).map((r) => r.reward)
    expect(rewards).toEqual([1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 3])
    expect((await getRewardStatus()).balance).toBe(18)
  })

  test('lỡ một ngày thì chuỗi về 0, lần điểm danh sau bắt đầu lại từ 1', async () => {
    await registerUser()
    await checkInDays(3)
    setDay('2026-10-04')
    expect(await getRewardStatus()).toMatchObject({ streak: 3, checkedInToday: false })
    setDay('2026-10-05')
    expect(await getRewardStatus()).toMatchObject({ streak: 0, nextReward: 1 })
    expect((await checkIn()).streak).toBe(1)
  })

  test('hôm sau ngày 6 thì lần điểm danh tiếp theo được +3', async () => {
    await registerUser()
    await checkInDays(6)
    setDay('2026-10-07')
    expect((await getRewardStatus()).nextReward).toBe(3)
  })

  test('khách không điểm danh được', async () => {
    signOut()
    await expect(checkIn()).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})

describe('đề cử', () => {
  /** Người dùng mới có `days` ngày điểm danh, rồi tài khoản đủ tuổi để đề cử */
  async function readerWithTickets(days: number) {
    const id = await registerUser('Lan', 'lan@gmail.com')
    await checkInDays(days)
    setDay('2026-10-20')
    return id
  }

  test('tài khoản mới tạo chưa đủ 3 ngày thì chưa đề cử được', async () => {
    await registerUser()
    await checkIn()
    expect(await codeOf(voteStory(seedSlug, 1))).toBe('account_too_new')
    setDay('2026-10-04')
    expect(await codeOf(voteStory(seedSlug, 1))).toBe('ok')
  })

  test('đề cử trừ phiếu, cộng vào tổng của truyện và phiếu của mình', async () => {
    await readerWithTickets(5)
    expect(await voteStory(seedSlug, 3)).toEqual({ balance: 2, total: 3 })
    expect(await getStoryVoteSummary(seedSlug)).toEqual({ total: 3, week: 3, mine: 3 })
    expect(await getRewardStatus()).toMatchObject({ balance: 2 })
  })

  test('không đủ phiếu, số phiếu sai: bị chặn và không trừ gì', async () => {
    await readerWithTickets(2)
    expect(await codeOf(voteStory(seedSlug, 3))).toBe('insufficient_tickets')
    expect(await codeOf(voteStory(seedSlug, 0))).toBe('invalid_amount')
    expect(await codeOf(voteStory(seedSlug, 1.5))).toBe('invalid_amount')
    expect((await getRewardStatus()).balance).toBe(2)
    expect((await getStoryVoteSummary(seedSlug)).total).toBe(0)
  })

  test('không đề cử được truyện của mình và truyện chưa công khai', async () => {
    await readerWithTickets(3)
    const mine = await publishStory('Truyện Của Lan', 1)
    expect(await codeOf(voteStory(mine.slug, 1))).toBe('own_story')
    const draft = await draftStory('Bản Nháp', 1)
    expect(await codeOf(voteStory(draft.slug, 1))).toBe('not_found')
    expect(await codeOf(getStoryVoteSummary(draft.slug))).toBe('not_found')
  })

  test('tổng 7 ngày bỏ phiếu cũ; khách xem được tổng, phiếu của mình là 0', async () => {
    await readerWithTickets(5)
    await voteStory(seedSlug, 2)
    setDay('2026-10-28')
    await voteStory(seedSlug, 1)
    signOut()
    expect(await getStoryVoteSummary(seedSlug)).toEqual({ total: 3, week: 1, mine: 0 })
  })
})

describe('lịch sử phiếu', () => {
  test('mới nhất trước, có số dư sau mỗi giao dịch và tên truyện được đề cử', async () => {
    await registerUser()
    await checkInDays(7)
    setDay('2026-10-10')
    await voteStory(seedSlug, 4)
    const history = await getTicketHistory()
    expect(history.total).toBe(8)
    expect(history.items.slice(0, 2)).toMatchObject([
      { amount: -4, reason: 'vote', balanceAfter: 5, story: { slug: seedSlug } },
      { amount: 3, reason: 'checkin', balanceAfter: 9, story: null },
    ])
  })

  test('20 dòng mỗi trang, mỗi người chỉ thấy sổ của mình', async () => {
    await registerUser()
    await checkInDays(25)
    expect((await getTicketHistory({ page: 2 })).items).toHaveLength(5)
    signInAs('demo')
    expect((await getTicketHistory()).total).toBe(0)
  })
})

describe('xếp hạng và thống kê theo đề cử', () => {
  test('bảng "Đề cử" theo kỳ: 7 ngày bỏ phiếu cũ, mọi lúc tính hết', async () => {
    await registerUser()
    await checkInDays(9)
    setDay('2026-10-10')
    await voteStory(seedStories[1].slug, 5)
    setDay('2026-10-20')
    await voteStory(seedSlug, 2)
    const week = await getRanking({ by: 'votes', period: 'week' })
    expect(week.map((r) => [r.story.slug, r.value])).toEqual([[seedSlug, 2]])
    const all = await getRanking({ by: 'votes', period: 'all' })
    expect(all.map((r) => r.value)).toEqual([5, 2])
  })

  test('tác giả thấy số đề cử của truyện mình trong thống kê', async () => {
    const author = await registerUser('Tác Giả', 'tacgia@gmail.com')
    const story = await publishStory('Truyện Được Đề Cử', 1)
    await registerUser('Lan', 'lan@gmail.com')
    await checkInDays(4)
    setDay('2026-10-10')
    await voteStory(story.slug, 3)
    signInAs(author)
    expect((await getStoryStats(story.id)).votes).toEqual({ total: 3, week: 3 })
  })
})
