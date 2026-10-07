// Giọng AI qua hàm Vercel api/tts (gửi access token của Supabase Auth). App di động chép file này
// làm api.ts. Plan: documents/plan-giong-ai.md
import { db } from '@/lib/supabase'
import { TTS_ENDPOINT } from './endpoint'
import { type TtsManifest, type TtsRequest, TtsError, toTtsCode } from './shared'

/** Địa chỉ file âm thanh của các đoạn trong chương; tạo các đoạn trong `generate` nếu chưa có */
export async function fetchClips(request: TtsRequest): Promise<TtsManifest> {
  const { data } = await db().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new TtsError('unauthenticated')
  let response: Response
  try {
    response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(request),
    })
  } catch {
    throw new TtsError('network')
  }
  const body = (await response.json().catch(() => null)) as
    (TtsManifest & { code?: undefined }) | { code?: string } | null
  if (!response.ok || !body || !('paragraphs' in body)) throw new TtsError(toTtsCode(body?.code))
  return body
}
