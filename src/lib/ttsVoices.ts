// Giọng AI (Google Cloud Text-to-Speech, loại Chirp 3 HD) cho nghe truyện. Dùng chung với hàm Vercel
// api/tts (danh sách giọng được phép), nên file này không import gì, không dùng alias `@/`.
// App di động chép nguyên file này. Plan: documents/plan-giong-ai.md

export type TtsVoice = {
  /** Tên giọng của Google (phần cuối của `vi-VN-Chirp3-HD-<id>`), cũng là thư mục trên R2 */
  id: string
  label: string
  gender: 'female' | 'male'
}

export const TTS_VOICES: readonly TtsVoice[] = [
  { id: 'Aoede', label: 'Giọng nữ 1', gender: 'female' },
  { id: 'Kore', label: 'Giọng nữ 2', gender: 'female' },
  { id: 'Charon', label: 'Giọng nam 1', gender: 'male' },
  { id: 'Puck', label: 'Giọng nam 2', gender: 'male' },
]

export const isTtsVoice = (id: unknown): id is string =>
  typeof id === 'string' && TTS_VOICES.some((v) => v.id === id)

export const findTtsVoice = (id: string | null) => TTS_VOICES.find((v) => v.id === id) ?? null

export const googleVoiceName = (id: string) => `vi-VN-Chirp3-HD-${id}`
