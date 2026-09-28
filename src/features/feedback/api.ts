// Nơi DUY NHẤT gửi góp ý của người dùng: tin nhắn liên hệ và báo lỗi chương. Có Supabase thì dùng
// bảng contact_messages và RPC report_chapter (api.remote.ts), không thì lưu localStorage
// (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
// Báo lỗi của truyện người dùng đăng hiện ở khu Sáng tác của tác giả.
import { supabase } from '@/lib/supabase'
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

const api: typeof mock = supabase ? remote : mock

export const { sendContactMessage, reportChapter } = api
