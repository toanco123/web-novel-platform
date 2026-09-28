import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Bội số của tốc độ đọc trung bình (1× = WORDS_PER_MINUTE chữ/phút) */
export const AUTO_SCROLL_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const

type AutoScrollSettings = {
  speed: number
  update: (patch: Partial<Omit<AutoScrollSettings, 'update'>>) => void
}

export const useAutoScrollSettings = create<AutoScrollSettings>()(
  persist(
    (set) => ({
      speed: 1,
      update: (patch) => set(patch),
    }),
    { name: 'reader-autoscroll', version: 1 },
  ),
)
