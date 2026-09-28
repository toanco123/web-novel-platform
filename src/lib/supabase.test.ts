import { supabase } from './supabase'

// Test tự động phải chạy trên dữ liệu giả (vite.config.ts đặt VITE_USE_MOCK=true), không bao giờ
// ghi vào project Supabase thật dù .env có cấu hình
test('test tự động không dùng Supabase thật', () => {
  expect(supabase).toBeNull()
})
