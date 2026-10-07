// Gọi Google Cloud Text-to-Speech (REST, xác thực bằng API key chỉ mở cho Text-to-Speech API).
// Plan: documents/plan-giong-ai.md
import { googleVoiceName } from '../../src/lib/ttsVoices.js'

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize'
const TIMEOUT_MS = 15_000

/** Đọc `text` bằng giọng `voice` (id trong TTS_VOICES), trả file MP3; lỗi thì ném */
export async function synthesize(text: string, voice: string, apiKey: string) {
  const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'vi-VN', name: googleVoiceName(voice) },
      // Luôn tạo ở tốc độ 1.0: người nghe đổi tốc độ khi phát, một file dùng cho mọi tốc độ
      audioConfig: { audioEncoding: 'MP3' },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Google TTS trả mã ${response.status}`)
  const { audioContent } = (await response.json()) as { audioContent?: string }
  if (!audioContent) throw new Error('Google TTS không trả âm thanh')
  return new Uint8Array(Buffer.from(audioContent, 'base64'))
}
