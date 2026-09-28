// Nơi DUY NHẤT xử lý khu Sáng tác (truyện & chương của chính người dùng). Có Supabase thì dùng
// api.remote.ts, không thì dùng dữ liệu giả trong localStorage (api.mock.ts: test tự động, làm UI
// offline). Hai bản cùng chữ ký hàm; mọi hàm kiểm tra đăng nhập và quyền sở hữu.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

export const {
  getMyStories,
  getMyStory,
  createStory,
  updateStory,
  publishStory,
  unpublishStory,
  deleteStory,
  getMyChapters,
  getMyChapter,
  saveChapter,
  setChapterStatus,
  deleteChapter,
  importChapters,
  getStoryStats,
  getStoryReports,
  setReportStatus,
} = api
