// Nơi DUY NHẤT xử lý tủ truyện: truyện theo dõi, số chương mới, lịch sử đọc. Có Supabase thì
// dùng bảng follows/reading_history và RPC (api.remote.ts), không thì dùng dữ liệu giả trong
// localStorage (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
// Khách chưa đăng nhập vẫn có lịch sử đọc (lưu trên máy), gộp vào tài khoản ở lần đầu đăng nhập.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

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
