// Nhận biết lỗi do mất mạng / mạng chập chờn (khác lỗi máy chủ trả về), để phần đọc offline dùng
// bản lưu trên máy thay vì báo lỗi.

/** Thông báo lỗi fetch của Chrome, Firefox, Safari và Node (undici) */
const FETCH_FAILED = /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed/i

/**
 * Lỗi mạng: máy đang offline, hoặc fetch không tới được máy chủ. supabase-js không ném lỗi fetch
 * mà trả `{ message: 'TypeError: Failed to fetch', code: '' }`, nên kiểm theo message.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && FETCH_FAILED.test(message)
}
