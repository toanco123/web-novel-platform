import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

type ThemeState = {
  theme: Theme
  toggleTheme: () => void
}

// Key 'theme' cũng được đọc bởi script inline trong index.html để tránh nháy màu khi tải trang
export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'theme' },
  ),
)

useTheme.subscribe(({ theme }) => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
})
