import type { SpeechEngine } from './session'
import { splitForSpeech } from './splitForSpeech'
import { speechSupported } from './useVoices'

type DeviceVoiceSettings = () => { rate: number; voice: SpeechSynthesisVoice | null }

/**
 * Giọng của máy (Web Speech API): mỗi đoạn tách thành câu ngắn, đọc nối tiếp. Không có pause tại chỗ
 * vì pause() của trình duyệt chạy không ổn định trên Android: tạm dừng = dừng hẳn rồi đọc lại đoạn.
 */
export function createDeviceEngine(settings: DeviceVoiceSettings): SpeechEngine {
  return {
    speak: (job, signal) =>
      new Promise<void>((resolve) => {
        const chunks = splitForSpeech(job.text)
        if (job.title) chunks.unshift(job.title)
        let k = 0
        const speakNext = () => {
          if (signal.aborted) return
          if (k >= chunks.length) return resolve()
          const utterance = new SpeechSynthesisUtterance(chunks[k++])
          const { rate, voice } = settings()
          utterance.lang = voice?.lang ?? 'vi-VN'
          utterance.rate = rate
          if (voice) utterance.voice = voice
          utterance.onend = speakNext
          // Lỗi do chính mình dừng thì bỏ qua; lỗi khác thì bỏ câu đó, đọc câu sau
          utterance.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') speakNext()
          }
          speechSynthesis.speak(utterance)
        }
        speakNext()
      }),
    cancel: () => {
      if (speechSupported()) speechSynthesis.cancel()
    },
  }
}
