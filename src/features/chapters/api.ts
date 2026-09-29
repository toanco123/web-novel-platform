// Nơi DUY NHẤT lấy dữ liệu chương cho người đọc. Có Supabase thì đọc database (api.remote.ts),
// không thì dùng danh mục giả trong localStorage (api.mock.ts: test tự động, làm UI offline). Hai
// bản cùng chữ ký hàm.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

export const { getChapterList, getChapter, getChapterRange, countChaptersFrom, recordChapterView } =
  api
