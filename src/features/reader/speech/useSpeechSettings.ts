import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const SPEECH_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const

type SpeechSettings = {
  rate: number
  /** voiceURI của giọng đã chọn; null: tự chọn giọng tiếng Việt đầu tiên */
  voiceURI: string | null
  /** Hết chương thì tự chuyển sang chương sau và đọc tiếp */
  autoNext: boolean
  update: (patch: Partial<Omit<SpeechSettings, 'update'>>) => void
}

export const useSpeechSettings = create<SpeechSettings>()(
  persist(
    (set) => ({
      rate: 1,
      voiceURI: null,
      autoNext: true,
      update: (patch) => set(patch),
    }),
    { name: 'reader-speech', version: 1 },
  ),
)
