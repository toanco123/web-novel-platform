// Nơi DUY NHẤT xử lý thể loại. Có Supabase thì dùng bảng genres/view genre_cards (api.remote.ts),
// không thì dùng thể loại có sẵn + do người dùng tạo trong localStorage (api.mock.ts: test tự động,
// làm UI offline). Hai bản cùng chữ ký hàm.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const { getGenres, createGenre } = api
