// Nơi DUY NHẤT xử lý khu Sáng tác (truyện & chương của chính người dùng). Có Supabase thì dùng
// api.remote.ts, không thì dùng dữ liệu giả trong localStorage (api.mock.ts: test tự động, làm UI
// offline). Hai bản cùng chữ ký hàm; mọi hàm kiểm tra đăng nhập và quyền sở hữu.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const {
  getMyStories,
  getMyStory,
  createStory,
  updateStory,
  publishStory,
  unpublishStory,
  submitStoryForReview,
  deleteStory,
  getMyChapters,
  getMyChapter,
  saveChapter,
  setChapterStatus,
  setChapterSchedule,
  scheduleChapters,
  deleteChapter,
  importChapters,
  getStoryStats,
  getStoryReports,
  setReportStatus,
} = api
