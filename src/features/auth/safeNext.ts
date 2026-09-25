/**
 * Chỉ cho phép chuyển hướng tới đường dẫn nội bộ (bắt đầu bằng một dấu "/"),
 * chặn "//evil.com", "/\evil.com" hay "https://..." để tránh open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = '/') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback
  }
  return next
}
