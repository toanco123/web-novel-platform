// Lọc lỗi trước khi gửi Sentry và ẩn token trong URL (plan documents/plan-theo-doi-loi.md). Logic
// thuần, không import Sentry (kiểu event khai báo theo cấu trúc) nên app di động chép nguyên được.
import { isNetworkError } from './network'

/**
 * Lớp lỗi nghiệp vụ của các feature: đã báo cho người dùng bằng câu tiếng Việt, không phải lỗi code.
 * So theo `name` (mỗi lớp tự đặt) để file này không import các feature. Feature mới có lớp lỗi
 * riêng thì thêm tên vào đây.
 */
const EXPECTED_ERRORS = new Set([
  'AuthError',
  'StudioError',
  'AdminError',
  'GenreExistsError',
  'BulkImportError',
  'CoverError',
  'ImageLimitError',
  'ChapterNotSavedError',
  'OfflineUnavailableError',
  'OfflineStorageFullError',
  'StorageFullError',
  'RewardError',
  // App di động: máy không nhận được thông báo đẩy (máy ảo, chưa cho phép)
  'PushUnavailableError',
])

/** Mã lỗi PostgREST dự kiến: luật nghiệp vụ (P0001), trùng khóa, trang vượt tổng */
const EXPECTED_DB_CODES = new Set(['P0001', '23505', 'PGRST103'])

/** Không tải được file JS của trang: thường do web vừa lên bản mới, RouteError đã có nút tải lại */
const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/

type DbError = { code: string; message: string; details: unknown; hint: unknown }

const isDbError = (error: unknown): error is DbError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as DbError).code === 'string' &&
  typeof (error as DbError).message === 'string' &&
  'details' in error &&
  'hint' in error

/** true: lỗi bất thường, cần gửi để sửa. Mất mạng hay lỗi mạng (isNetworkError) thì không gửi */
export function shouldReport(error: unknown): boolean {
  if (isNetworkError(error)) return false
  if (isDbError(error)) return !EXPECTED_DB_CODES.has(error.code)
  if (!(error instanceof Error)) return true
  if (EXPECTED_ERRORS.has(error.name)) return (error as { code?: unknown }).code === 'unknown'
  return !CHUNK_ERROR.test(error.message)
}

/** Phần của event Sentry mà file này đọc / sửa (khai báo theo cấu trúc, khỏi import Sentry) */
type ReportEvent = {
  exception?: { values?: { type?: string; value?: string }[] }
  request?: {
    url?: string
    headers?: Record<string, string>
    cookies?: unknown
    query_string?: unknown
  }
  transaction?: string
}
type ReportBreadcrumb = { message?: string; data?: Record<string, unknown> }

/**
 * Lỗi Sentry tự bắt (window.onerror, promise bị bỏ quên) cũng đi qua shouldReport. Dùng lỗi gốc
 * (`originalException`) để còn `code` của lớp lỗi feature; không có thì dựng lại từ event
 */
export function shouldSendEvent(event: ReportEvent, hint?: { originalException?: unknown }) {
  if (hint?.originalException != null) return shouldReport(hint.originalException)
  const exception = event.exception?.values?.at(-1)
  if (!exception) return true
  return shouldReport(
    Object.assign(new Error(exception.value ?? ''), { name: exception.type ?? 'Error' }),
  )
}

/**
 * Lỗi PostgREST là object `{ code, message, details, hint }`: đổi thành Error để Sentry gom nhóm
 * theo mã và có stack trace; chi tiết để ở `extra`
 */
export function toReportable(error: unknown): { error: Error; extra: Record<string, unknown> } {
  if (isDbError(error)) {
    const { code, message, details, hint } = error
    const wrapped = new Error(`${code}: ${message}`)
    wrapped.name = 'PostgrestError'
    return { error: wrapped, extra: { code, details, hint } }
  }
  if (error instanceof Error) return { error, extra: {} }
  return { error: new Error(String(error)), extra: {} }
}

// ── Ẩn token trong URL ──────────────────────────────────────────────────

/**
 * Link xác nhận email, đặt lại mật khẩu và OAuth của Supabase mang mã đăng nhập trên URL (query
 * `code`, `token_hash`; hash `access_token`, `refresh_token`...). Thay giá trị bằng "[đã ẩn]".
 */
const SENSITIVE_PARAM =
  /([?&#](?:access_token|refresh_token|provider_token|provider_refresh_token|code|token_hash|token)=)[^&#]*/g

export const scrubUrl = (url: string) => url.replace(SENSITIVE_PARAM, '$1[đã ẩn]')

const scrubValue = (value: unknown) => (typeof value === 'string' ? scrubUrl(value) : value)

/** Ẩn token và bỏ header (trừ User-Agent), cookie, query của event; sửa tại chỗ */
export function scrubEvent(event: ReportEvent) {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url)
    // Giữ User-Agent (Sentry suy ra trình duyệt, hệ điều hành), bỏ Referer có thể chứa token
    const userAgent = event.request.headers?.['User-Agent']
    event.request.headers = userAgent ? { 'User-Agent': userAgent } : undefined
    delete event.request.cookies
    delete event.request.query_string
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction)
}

/** Ẩn token trong breadcrumb (điều hướng, fetch); sửa tại chỗ */
export function scrubBreadcrumb(breadcrumb: ReportBreadcrumb) {
  if (breadcrumb.message) breadcrumb.message = scrubUrl(breadcrumb.message)
  if (breadcrumb.data) {
    for (const key of ['url', 'from', 'to']) {
      if (key in breadcrumb.data) breadcrumb.data[key] = scrubValue(breadcrumb.data[key])
    }
  }
}
