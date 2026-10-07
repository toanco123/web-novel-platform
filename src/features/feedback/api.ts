// Nơi DUY NHẤT gửi góp ý của người dùng: tin nhắn liên hệ và báo lỗi chương. Có Supabase thì dùng
// bảng contact_messages và RPC report_chapter (api.remote.ts), không thì lưu localStorage
// (api.mock.ts: test tự động, làm UI offline). Hai bản cùng chữ ký hàm.
// Báo lỗi của truyện người dùng đăng hiện ở khu Sáng tác của tác giả.
import * as mock from './api.mock'
import * as remote from './api.remote'

export * from './shared'

// __USE_MOCK__ là hằng lúc build (vite.config.ts): bản build có Supabase bỏ hẳn api.mock.ts
const api: typeof mock = __USE_MOCK__ ? mock : remote

export const { sendContactMessage, reportChapter } = api
