// Nơi DUY NHẤT xử lý tủ truyện: truyện theo dõi, số chương mới, lịch sử đọc. Có Supabase thì
// dùng bảng follows/reading_history và RPC (api.remote.ts), không thì dùng dữ liệu giả trong
// localStorage (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
// Khách chưa đăng nhập vẫn có lịch sử đọc (lưu trên máy), gộp vào tài khoản ở lần đầu đăng nhập.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const {
  getFollowStatus,
  followStory,
  unfollowStory,
  getLibrary,
  getLibraryUpdateCount,
  getReadingHistory,
  getStoryProgress,
  saveReadingProgress,
  removeFromHistory,
  clearHistory,
  syncPendingProgress,
} = api
