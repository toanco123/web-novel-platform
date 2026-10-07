// Hàm Vercel của Giọng AI (nghe truyện): POST /api/tts. Xử lý ở _lib/tts.ts; file này chỉ nối với
// Supabase, Google và R2 theo biến môi trường. Plan: documents/plan-giong-ai.md
import { fetchUserId, publicChapter, rpc, serviceConfig, supabaseConfig } from './_lib/data.js'
import { synthesize } from './_lib/google.js'
import { createR2 } from './_lib/r2.js'
import { errorResponse, handleTts, type TtsDeps } from './_lib/tts.js'

/** Mức chặn mặc định: 90% hạn mức miễn phí 1 triệu ký tự / tháng của Chirp 3 HD; ~2 chương / người / ngày */
const DEFAULT_MONTH_CAP = 900_000
const DEFAULT_DAY_CAP = 30_000

const positive = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** Phụ thuộc lấy từ biến môi trường; thiếu biến nào thì null (Giọng AI tạm tắt) */
export function ttsDeps(env: Record<string, string | undefined> = process.env): TtsDeps | null {
  const anon = supabaseConfig(env)
  const service = serviceConfig(env)
  const googleKey = env.GOOGLE_TTS_API_KEY
  const r2Env = {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.TTS_PUBLIC_BASE_URL,
  }
  if (!anon || !service || !googleKey || Object.values(r2Env).some((v) => !v)) return null
  const r2 = createR2(r2Env as Record<keyof typeof r2Env, string>)
  const monthCap = positive(env.TTS_MONTH_CHAR_CAP, DEFAULT_MONTH_CAP)
  const dayCap = positive(env.TTS_USER_DAY_CHAR_CAP, DEFAULT_DAY_CAP)

  return {
    verifyUser: (token) => fetchUserId(anon, token),
    loadChapter: (slug, chapter) => publicChapter(anon, slug, chapter),
    lookup: async (voice, hashes) => {
      const rows = await rpc<(string | Record<string, string>)[]>(service, 'tts_lookup', {
        p_voice: voice,
        p_hashes: hashes,
      })
      // Hàm trả setof text: PostgREST trả mảng giá trị hoặc mảng { tts_lookup: giá trị }
      return (rows ?? []).map((row) => (typeof row === 'string' ? row : Object.values(row)[0]))
    },
    reserve: async (userId, chars) => {
      await rpc(service, 'tts_reserve', {
        p_user: userId,
        p_chars: chars,
        p_month_cap: monthCap,
        p_day_cap: dayCap,
      })
    },
    commit: async (userId, voice, clips, refund) => {
      await rpc(service, 'tts_commit', {
        p_user: userId,
        p_voice: voice,
        p_clips: clips,
        p_refund: refund,
      })
    },
    synthesize: (text, voice) => synthesize(text, voice, googleKey),
    upload: (key, bytes) => r2.put(key, bytes),
    publicUrl: r2.publicUrl,
  }
}

export async function POST(request: Request) {
  const deps = ttsDeps()
  if (!deps) return errorResponse('tts_unavailable')
  try {
    return await handleTts(request, deps)
  } catch (error) {
    console.error('api/tts', error)
    return errorResponse('tts_unavailable')
  }
}
