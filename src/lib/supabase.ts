import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Giai đoạn làm UI dùng mock nên chưa cần key; client chỉ được tạo khi đã cấu hình .env.local.
// Kiểu Database sinh từ schema: supabase gen types typescript --linked --schema public
export const supabase = url && anonKey ? createClient<Database>(url, anonKey) : null
