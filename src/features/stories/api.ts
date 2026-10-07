// Nơi DUY NHẤT lấy dữ liệu truyện. Có Supabase thì đọc từ database (api.remote.ts), không thì đọc
// danh mục giả (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

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
