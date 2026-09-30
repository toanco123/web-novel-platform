// Đổi tên web ở đây (vd 'Mộng Truyện') — logo, footer, <title> đều lấy từ hằng này.
// File này còn được hàm Vercel (api/) và cấu hình build đọc, nên chỉ chứa hằng thuần: không import
// gì và không dùng import.meta.
export const SITE_NAME = 'Web Truyện'
export const SITE_TAGLINE =
  'Đọc truyện chữ ngôn tình, cổ đại, xuyên không. Miễn phí, cập nhật chương mới mỗi ngày.'

/**
 * Địa chỉ web khi không khai báo VITE_SITE_URL (canonical, sitemap, ảnh xem trước). Có tên miền
 * riêng thì đặt VITE_SITE_URL trên Vercel, không cần sửa ở đây.
 */
export const DEFAULT_SITE_URL = 'https://web-novel-platform-gules.vercel.app'

/** Ảnh xem trước khi chia sẻ link (1200×630) cho trang không có ảnh bìa; file trong public/ */
export const DEFAULT_OG_IMAGE = '/og-default.png'
