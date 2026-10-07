export type MobilePlatform = 'ios' | 'android'

/**
 * Điện thoại/máy tính bảng iOS hay Android; máy tính trả null. iPadOS 13+ tự báo là Mac nên nhận ra
 * bằng màn cảm ứng (Mac thật có maxTouchPoints = 0).
 */
export function mobilePlatform(ua: string, maxTouchPoints: number): MobilePlatform | null {
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return 'ios'
  return null
}

export const currentMobilePlatform = () =>
  mobilePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0)

/** Đang mở trong PWA đã cài lên màn hình chính */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
