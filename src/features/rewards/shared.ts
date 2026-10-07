// Phần dùng chung của hai backend điểm danh và phiếu đề cử (api.mock.ts, api.remote.ts).
// Luật: documents/plan-diem-danh-va-de-cu.md (mục 1, 2). DB viết cứng cùng các hằng số dưới đây.

/** Phiếu mỗi lần điểm danh */
export const CHECKIN_REWARD = 1
/** Phiếu của ngày thứ 7, 14, 21… trong chuỗi liên tiếp */
export const CHECKIN_BONUS_REWARD = 3
export const CHECKIN_CYCLE = 7
/** Tài khoản phải tạo đủ số ngày này mới đề cử được (chống tạo nhiều tài khoản để dồn phiếu) */
export const VOTE_MIN_ACCOUNT_AGE_DAYS = 3
export const VOTE_MAX_AMOUNT = 1000
export const TICKET_HISTORY_PAGE_SIZE = 20
/** Số truyện ở khối "Đề cử tuần" trên trang chủ */
export const TOP_VOTED_LIMIT = 6

export type RewardStatus = {
  /** Số phiếu đang có */
  balance: number
  /** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD), do máy chủ trả */
  today: string
  checkedInToday: boolean
  /** Chuỗi hiện tại: số ngày liên tiếp tới lần điểm danh gần nhất (hôm nay hoặc hôm qua), không thì 0 */
  streak: number
  /** Số phiếu của lần điểm danh tiếp theo */
  nextReward: number
}

export type CheckInResult = { reward: number; streak: number; balance: number }

export type LedgerEntry = {
  id: string
  /** + nhận, − dùng */
  amount: number
  reason: 'checkin' | 'vote'
  /** Truyện được đề cử; null khi điểm danh hoặc truyện đã bị xóa */
  story: { slug: string; title: string } | null
  balanceAfter: number
  createdAt: string
}

export type StoryVoteSummary = {
  /** Tổng phiếu mọi lúc */
  total: number
  /** Phiếu trong 7 ngày gần nhất */
  week: number
  /** Phiếu người đang đăng nhập đã đề cử truyện này (khách: 0) */
  mine: number
}

export type VoteResult = { balance: number; total: number }

const messages = {
  already_checked_in: 'Hôm nay bạn đã điểm danh rồi. Quay lại ngày mai nhé.',
  insufficient_tickets: 'Bạn không đủ phiếu. Điểm danh mỗi ngày để nhận thêm.',
  own_story: 'Bạn không đề cử được truyện của chính mình.',
  account_too_new: `Tài khoản cần tạo đủ ${VOTE_MIN_ACCOUNT_AGE_DAYS} ngày mới đề cử được.`,
  invalid_amount: `Số phiếu phải từ 1 tới ${VOTE_MAX_AMOUNT}.`,
  not_found: 'Truyện này không còn công khai.',
}

export type RewardErrorCode = keyof typeof messages

export const isRewardErrorCode = (code: string): code is RewardErrorCode =>
  Object.hasOwn(messages, code)

export class RewardError extends Error {
  code: RewardErrorCode
  constructor(code: RewardErrorCode) {
    super(messages[code])
    this.name = 'RewardError'
    this.code = code
  }
}

/** Phiếu nhận được khi điểm danh lần thứ `streak` liên tiếp */
export const rewardFor = (streak: number) =>
  streak > 0 && streak % CHECKIN_CYCLE === 0 ? CHECKIN_BONUS_REWARD : CHECKIN_REWARD

/** Vị trí trong chu kỳ 7 ngày (1–7) của lần điểm danh thứ `streak`; 0 khi chưa có chuỗi */
export const cycleDay = (streak: number) => (streak > 0 ? ((streak - 1) % CHECKIN_CYCLE) + 1 : 0)

/**
 * Ô ngày của thẻ điểm danh: bao nhiêu ô đầu đã nhận, ô nào là hôm nay. Chưa điểm danh hôm nay thì
 * ô hôm nay nằm ngay sau chuỗi hiện tại; vừa nhận đủ 7 ngày (hôm qua) thì sang chu kỳ mới.
 */
export function cycleProgress(status: Pick<RewardStatus, 'streak' | 'checkedInToday'>) {
  if (status.checkedInToday) {
    const today = cycleDay(status.streak)
    return { claimed: today, today }
  }
  const claimed = cycleDay(status.streak) % CHECKIN_CYCLE
  return { claimed, today: claimed + 1 }
}

const vnDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Ngày theo giờ Việt Nam, dạng 2026-10-07 (bản giả; bản thật do DB tính) */
export const vnDay = (date = new Date()) => vnDate.format(date)

/** Ngày liền trước của một ngày YYYY-MM-DD */
export function previousDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/** Câu mô tả một dòng lịch sử phiếu */
export const ledgerText = (entry: LedgerEntry) =>
  entry.reason === 'vote'
    ? 'Đề cử'
    : entry.amount > CHECKIN_REWARD
      ? 'Điểm danh · thưởng chuỗi 7 ngày'
      : 'Điểm danh'

/** Câu báo lỗi cho người dùng: lỗi nghiệp vụ, chưa đăng nhập, còn lại là lỗi chung */
export function rewardErrorMessage(error: unknown) {
  if (error instanceof Error && (error.name === 'RewardError' || error.name === 'AuthError')) {
    return error.message
  }
  return 'Có lỗi xảy ra, bạn thử lại sau nhé.'
}
