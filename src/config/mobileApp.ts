import type { MobilePlatform } from '@/lib/platform'

/**
 * Link store của app di động (biến môi trường, khai báo trên Vercel). Chưa khai báo hoặc không phải
 * https thì null: banner mời tải app không hiện trên nền tảng đó. Tách khỏi site.ts vì file đó không
 * được dùng import.meta.
 */
export function storeUrl(platform: MobilePlatform): string | null {
  const raw =
    platform === 'ios' ? import.meta.env.VITE_APP_STORE_URL : import.meta.env.VITE_PLAY_STORE_URL
  const url = raw?.trim() ?? ''
  return url.startsWith('https://') ? url : null
}
