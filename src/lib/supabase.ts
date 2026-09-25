import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Giai đoạn làm UI dùng mock nên chưa cần key; client chỉ được tạo khi đã cấu hình .env.local
export const supabase = url && anonKey ? createClient(url, anonKey) : null
