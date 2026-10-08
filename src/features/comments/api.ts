// Nơi DUY NHẤT xử lý bình luận và chấm điểm. Có Supabase thì dùng bảng comments/ratings
// (api.remote.ts), không thì dùng bình luận mẫu + localStorage (api.mock.ts: test tự động, làm UI
// offline). Hai bản cùng chữ ký hàm.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const {
  getComments,
  getReplies,
  addComment,
  editComment,
  setCommentLike,
  deleteComment,
  reportComment,
  getRatingSummary,
  getMyRating,
  rateStory,
} = api
