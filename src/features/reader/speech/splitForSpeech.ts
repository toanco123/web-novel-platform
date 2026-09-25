/** Độ dài tối đa mỗi câu đưa cho giọng đọc: Chrome hay tự dừng giữa chừng với câu quá dài */
export const SPEECH_CHUNK_MAX = 220

/**
 * Tách một đoạn văn thành các câu ngắn để đọc: cắt ở dấu kết câu, câu còn dài thì cắt ở dấu
 * phẩy/chấm phẩy, cuối cùng cắt ở khoảng trắng.
 */
export function splitForSpeech(text: string, max = SPEECH_CHUNK_MAX): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const sentences = clean.match(/[^.!?…]+(?:[.!?…]+["”’)»]*|$)/g) ?? [clean]
  return sentences.flatMap((s) => splitLong(s.trim(), max)).filter(Boolean)
}

function splitLong(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence]
  const parts = sentence.match(/[^,;:]+(?:[,;:]+|$)/g) ?? [sentence]
  const chunks: string[] = []
  let current = ''
  for (const part of parts.flatMap((p) => byWords(p.trim(), max))) {
    if (current && current.length + 1 + part.length > max) {
      chunks.push(current)
      current = part
    } else {
      current = current ? `${current} ${part}` : part
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/** Cắt theo từ khi một vế câu vẫn dài hơn max */
function byWords(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  const chunks: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    if (current && current.length + 1 + word.length > max) {
      chunks.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) chunks.push(current)
  return chunks
}
