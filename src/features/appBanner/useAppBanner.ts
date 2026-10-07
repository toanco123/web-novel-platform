import { useState } from 'react'
import { useLocation } from 'react-router'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storeUrl } from '@/config/mobileApp'
import { currentMobilePlatform, isStandalone, type MobilePlatform } from '@/lib/platform'
import { paths } from '@/lib/routes'

/** Tắt banner (bấm ✕ hoặc "Tải app") thì bao nhiêu ngày sau mới hiện lại */
export const SNOOZE_DAYS = 30
const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000

/** Dữ liệu localStorage có thể hỏng hoặc giờ máy bị lệch: chỉ tin mốc hợp lệ trong quá khứ */
export function isSnoozed(dismissedAt: unknown, now: number): boolean {
  if (typeof dismissedAt !== 'number' || !Number.isFinite(dismissedAt)) return false
  const elapsed = now - dismissedAt
  return elapsed >= 0 && elapsed < SNOOZE_MS
}

type AppBannerState = {
  dismissedAt: number | null
  /** Đã tắt trong lần mở web này (không lưu): ẩn ngay, không chờ so mốc thời gian */
  dismissedThisSession: boolean
  dismiss: () => void
}

export const useAppBannerStore = create<AppBannerState>()(
  persist(
    (set) => ({
      dismissedAt: null,
      dismissedThisSession: false,
      dismiss: () => set({ dismissedAt: Date.now(), dismissedThisSession: true }),
    }),
    { name: 'app-banner', partialize: ({ dismissedAt }) => ({ dismissedAt }) },
  ),
)

/**
 * Store cần mở trên máy này, hoặc null nếu không hiện banner: máy tính, nền tảng chưa có link, PWA
 * đã cài, vừa tắt chưa đủ SNOOZE_DAYS ngày, đang ở khu Sáng tác.
 */
export function useAppBannerTarget(): { platform: MobilePlatform; url: string } | null {
  const dismissedAt = useAppBannerStore((s) => s.dismissedAt)
  const dismissedThisSession = useAppBannerStore((s) => s.dismissedThisSession)
  // Mốc "bây giờ" lấy một lần khi gắn banner (gọi Date.now() lúc render là không thuần)
  const [now] = useState(Date.now)
  const { pathname } = useLocation()
  if (pathname.startsWith(paths.studio)) return null
  if (dismissedThisSession || isSnoozed(dismissedAt, now)) return null
  const platform = currentMobilePlatform()
  if (!platform || isStandalone()) return null
  const url = storeUrl(platform)
  return url ? { platform, url } : null
}
