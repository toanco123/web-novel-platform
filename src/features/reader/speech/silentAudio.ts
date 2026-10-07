// Một đoạn âm thanh im lặng ngắn (WAV 8 kHz, 0,1 giây) dạng data URI: phát ngay trong lúc người
// dùng bấm để trình duyệt (iOS Safari) cho phép phát tiếp các clip sau; bản giả của Giọng AI cũng
// dùng làm clip. App di động chép nguyên.

function silentWav(sampleRate = 8000, seconds = 0.1) {
  const samples = Math.round(sampleRate * seconds)
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // độ dài khối fmt
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true) // byte mỗi giây (8 bit, mono)
  view.setUint16(32, 1, true) // byte mỗi mẫu
  view.setUint16(34, 8, true) // 8 bit
  ascii(36, 'data')
  view.setUint32(40, samples, true)
  bytes.fill(128, 44) // 8 bit không dấu: 128 là im lặng
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return `data:audio/wav;base64,${btoa(binary)}`
}

export const SILENT_AUDIO = silentWav()
