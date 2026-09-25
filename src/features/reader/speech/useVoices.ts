import { useEffect, useState } from 'react'

export const speechSupported = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof SpeechSynthesisUtterance !== 'undefined'

const isVietnamese = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith('vi')

/** Giọng đọc của máy, giọng tiếng Việt xếp trước (danh sách được nạp dần nên phải nghe sự kiện) */
export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    speechSupported() ? speechSynthesis.getVoices() : [],
  )

  useEffect(() => {
    if (!speechSupported()) return
    const synth = speechSynthesis
    const load = () => setVoices(synth.getVoices())
    load()
    synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener('voiceschanged', load)
  }, [])

  const vietnamese = voices.filter(isVietnamese)
  return { all: [...vietnamese, ...voices.filter((v) => !isVietnamese(v))], vietnamese }
}

/** Giọng sẽ dùng: giọng đã chọn nếu còn, không thì giọng tiếng Việt đầu tiên */
export function pickVoice(voices: SpeechSynthesisVoice[], voiceURI: string | null) {
  return voices.find((v) => v.voiceURI === voiceURI) ?? voices.find(isVietnamese) ?? null
}
