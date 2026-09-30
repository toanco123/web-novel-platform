// Nơi DUY NHẤT lấy dữ liệu cho trang quản trị /admin (chỉ xem). Có Supabase thì dùng
// api.remote.ts, không thì dùng dữ liệu giả trong localStorage (api.mock.ts). Hai bản cùng chữ ký
// hàm; mọi hàm chỉ cho quản trị viên (AdminError).
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

export const {
  getAdminOverview,
  getAdminUsers,
  getAdminStories,
  getAdminMessages,
  setMessageHandled,
  getAdminReports,
  setAdminReportStatus,
  setUserBanned,
  setStoryTakedown,
  updateGenre,
  deleteGenre,
  mergeGenres,
  getCuratedStories,
  setCuratedStories,
} = api
