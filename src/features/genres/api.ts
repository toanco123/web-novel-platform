// Nơi DUY NHẤT xử lý thể loại. Có Supabase thì dùng bảng genres/view genre_cards (api.remote.ts),
// không thì dùng thể loại có sẵn + do người dùng tạo trong localStorage (api.mock.ts: test tự động,
// làm UI offline). Hai bản cùng chữ ký hàm.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

export const { getGenres, createGenre } = api
