// Nơi DUY NHẤT điểm danh hằng ngày và dùng phiếu đề cử. Có Supabase thì gọi RPC (api.remote.ts),
// không thì lưu localStorage (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const { getRewardStatus, checkIn, getTicketHistory, getStoryVoteSummary, voteStory } = api
