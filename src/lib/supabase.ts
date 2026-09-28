import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const forceMock = import.meta.env.VITE_USE_MOCK === 'true'

/**
 * null khi chưa cấu hình .env hoặc đặt VITE_USE_MOCK=true: các api.ts khi đó dùng dữ liệu giả trong
 * localStorage (api.mock.ts). Test tự động luôn chạy trên dữ liệu giả (xem vite.config.ts).
 * Kiểu Database sinh từ schema: supabase gen types typescript --linked --schema public
 */
export const supabase =
  url && anonKey && !forceMock
    ? createClient<Database>(url, anonKey, {
        // PKCE: link đăng nhập mạng xã hội / đặt lại mật khẩu trả về ?code= thay vì token trên URL
        auth: { flowType: 'pkce' },
      })
    : null

/** Client cho các api.remote.ts (chỉ được gọi khi backend là Supabase) */
export function db() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình')
  return supabase
}
