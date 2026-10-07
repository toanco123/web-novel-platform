// Giọng AI cho nghe truyện: có Supabase thì gọi hàm Vercel api/tts (api.remote.ts), không thì trả
// clip im lặng (api.mock.ts: test, làm UI không cần mạng). Plan: documents/plan-giong-ai.md
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const { fetchClips } = api
