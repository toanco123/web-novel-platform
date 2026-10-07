// Nơi DUY NHẤT chặn / bỏ chặn người dùng (App Store Guideline 1.2: app di động bắt buộc có, web có
// cùng chức năng). Có Supabase thì dùng bảng user_blocks (api.remote.ts), không thì lưu localStorage
// (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const { blockUser, unblockUser, getBlockedUsers } = api
