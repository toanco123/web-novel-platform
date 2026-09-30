// Nơi DUY NHẤT xử lý bình luận và chấm điểm. Có Supabase thì dùng bảng comments/ratings
// (api.remote.ts), không thì dùng bình luận mẫu + localStorage (api.mock.ts: test tự động, làm UI
// offline). Hai bản cùng chữ ký hàm.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

export const {
  getComments,
  getReplies,
  addComment,
  deleteComment,
  reportComment,
  getRatingSummary,
  getMyRating,
  rateStory,
} = api
