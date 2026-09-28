// Nơi DUY NHẤT lấy dữ liệu truyện. Có Supabase thì đọc từ database (api.remote.ts), không thì đọc
// danh mục giả (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

export const {
  getFeaturedStories,
  getEditorPicks,
  getTrendingWeekly,
  getLatestUpdated,
  getNewReleases,
  getStory,
  getStoriesByAuthor,
  getRelatedStories,
  browseStories,
  searchStories,
  getSearchSuggestions,
  getRanking,
} = api
