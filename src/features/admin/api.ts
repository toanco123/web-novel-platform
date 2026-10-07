// Nơi DUY NHẤT lấy dữ liệu cho trang quản trị /admin (chỉ xem). Có Supabase thì dùng
// api.remote.ts, không thì dùng dữ liệu giả trong localStorage (api.mock.ts). Hai bản cùng chữ ký
// hàm; mọi hàm chỉ cho quản trị viên (AdminError).
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const {
  getAdminOverview,
  getAdminUsers,
  getAdminStories,
  getAdminMessages,
  setMessageHandled,
  getAdminReports,
  setAdminReportStatus,
  getAdminComments,
  deleteAdminComment,
  dismissCommentReports,
  setUserBanned,
  setStoryTakedown,
  reviewStory,
  updateGenre,
  deleteGenre,
  mergeGenres,
  getCuratedStories,
  setCuratedStories,
} = api
