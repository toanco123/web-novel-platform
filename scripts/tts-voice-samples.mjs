// Nghe thử các giọng Google Chirp 3 HD tiếng Việt để chọn 4 giọng cho Giọng AI (src/lib/ttsVoices.ts).
// Mỗi giọng đọc cùng một đoạn truyện ra một file MP3 (~400 ký tự / giọng, nằm trong phần miễn phí).
//
//   GOOGLE_TTS_API_KEY=... node scripts/tts-voice-samples.mjs [thư mục ra, mặc định tts-samples]
//
// Plan: documents/plan-giong-ai.md
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const key = process.env.GOOGLE_TTS_API_KEY
if (!key) {
  console.error('Thiếu GOOGLE_TTS_API_KEY')
  process.exit(1)
}
const outDir = process.argv[2] ?? 'tts-samples'
const API = 'https://texttospeech.googleapis.com/v1'

const SAMPLE =
  'Chương một. Gió lạnh. Đêm ấy, tuyết rơi trắng cả kinh thành Trường An. ' +
  'Nàng đứng lặng bên cửa sổ, nhìn những ngọn đèn lồng đỏ rực lay động dọc bờ sông. ' +
  '"Ngươi thật sự muốn đi sao?" Giọng hắn khàn đặc, như cố nén điều gì đó. ' +
  'Nàng không quay lại, chỉ khẽ gật đầu: "Ta đã hứa với sư phụ, ba năm sau sẽ trở về."'

const { voices = [] } = await fetch(`${API}/voices?languageCode=vi-VN&key=${key}`).then((r) =>
  r.json(),
)
const chirp = voices.filter((v) => v.name.includes('Chirp3-HD'))
if (!chirp.length) {
  console.error('Không lấy được danh sách giọng Chirp 3 HD tiếng Việt (kiểm tra API key)')
  process.exit(1)
}

await mkdir(outDir, { recursive: true })
for (const voice of chirp) {
  const id = voice.name.split('-').at(-1)
  const gender = voice.ssmlGender === 'FEMALE' ? 'nu' : voice.ssmlGender === 'MALE' ? 'nam' : 'khac'
  const response = await fetch(`${API}/text:synthesize?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text: SAMPLE },
      voice: { languageCode: 'vi-VN', name: voice.name },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  })
  if (!response.ok) {
    console.error(`${voice.name}: lỗi ${response.status}`)
    continue
  }
  const { audioContent } = await response.json()
  const file = join(outDir, `${gender}-${id}.mp3`)
  await writeFile(file, Buffer.from(audioContent, 'base64'))
  console.log(file)
}
console.log(
  `Xong ${chirp.length} giọng. Chọn 4 giọng rồi sửa TTS_VOICES trong src/lib/ttsVoices.ts`,
)
