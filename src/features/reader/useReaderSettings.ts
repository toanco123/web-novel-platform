import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** theme: theo giao diện sáng/tối của web; còn lại là màu nền riêng của trang đọc */
export type ReaderTone = 'theme' | 'white' | 'paper' | 'gray' | 'black'
export type ReaderFont = 'serif' | 'sans'
export type ReaderWidth = 'narrow' | 'medium' | 'wide'

export type ReaderSettings = {
  tone: ReaderTone
  font: ReaderFont
  /** px */
  fontSize: number
  lineHeight: number
  width: ReaderWidth
  /** Cuộn liên tục: hết chương thì chương sau tự nối vào bên dưới */
  continuous: boolean
}

export const READER_DEFAULTS: ReaderSettings = {
  tone: 'theme',
  font: 'serif',
  fontSize: 19,
  lineHeight: 1.85,
  width: 'medium',
  continuous: false,
}

export const FONT_SIZE_RANGE = { min: 15, max: 28 }
export const LINE_HEIGHT_RANGE = { min: 1.5, max: 2.3, step: 0.05 }

type ReaderSettingsState = ReaderSettings & {
  update: (patch: Partial<ReaderSettings>) => void
  reset: () => void
}

export const useReaderSettings = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      ...READER_DEFAULTS,
      update: (patch) => set(patch),
      reset: () => set(READER_DEFAULTS),
    }),
    { name: 'reader-settings', version: 1 },
  ),
)
