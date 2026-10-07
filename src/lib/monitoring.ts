// Theo dõi lỗi bằng Sentry (plan documents/plan-theo-doi-loi.md). File này nhẹ: hàng chờ và các hàm
// gọi từ app; lọc lỗi, ẩn token ở errorFilter.ts. Thư viện Sentry nằm ở sentryClient.ts, chỉ tải khi trình duyệt rảnh sau lúc mở trang (đỡ
// ~30 KB gzip khỏi lần tải đầu). Chỉ bật ở bản build có Supabase và có VITE_SENTRY_DSN; dev, test,
// bản dữ liệu giả không gửi gì.
import type { ErrorInfo } from 'react'
import { shouldReport, toReportable } from './errorFilter'

type Client = typeof import('./sentryClient')

const dsn = import.meta.env.VITE_SENTRY_DSN
/**
 * Tính lúc build (cả ba vế đều là hằng Vite thay vào): bản build không bật thì mọi lệnh gọi Sentry là
 * code chết và sentryClient.ts không có trong bundle
 */
const configured = import.meta.env.PROD && !__USE_MOCK__ && !!dsn

let client: Client | null = null
/** Việc chờ Sentry tải xong; giới hạn để không phình bộ nhớ nếu tải hỏng */
let pending: ((client: Client) => void)[] = []
const MAX_PENDING = 30

function withClient(task: (client: Client) => void) {
  if (client) task(client)
  else if (pending.length < MAX_PENDING) pending.push(task)
}

export function initMonitoring() {
  if (!configured || !dsn) return
  // Lỗi xảy ra trước khi Sentry tải xong: tự bắt rồi xếp hàng. Sentry tải xong thì tự bắt lấy
  const onError = (event: globalThis.ErrorEvent) =>
    reportError(event.error ?? event.message, { source: 'before-load' })
  const onRejection = (event: PromiseRejectionEvent) =>
    reportError(event.reason, { source: 'before-load' })
  addEventListener('error', onError)
  addEventListener('unhandledrejection', onRejection)
  const stopEarlyCapture = () => {
    removeEventListener('error', onError)
    removeEventListener('unhandledrejection', onRejection)
  }

  const load = () =>
    import('./sentryClient')
      .then((loaded) => {
        loaded.start(dsn)
        stopEarlyCapture()
        client = loaded
        for (const task of pending) task(loaded)
        pending = []
      })
      .catch(() => {
        // Không tải được (mất mạng, trình chặn quảng cáo): bỏ, không thử lại
        stopEarlyCapture()
        pending = []
      })
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 })
  else setTimeout(load, 2000)
}

/** Gửi lỗi lên Sentry nếu là lỗi bất thường (xem shouldReport); Sentry chưa bật thì bỏ qua */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!configured || !shouldReport(error)) return
  const reportable = toReportable(error)
  withClient((c) => c.capture(reportable.error, { ...context, ...reportable.extra }))
}

export function setMonitoringUser(id: string | null) {
  if (configured) withClient((c) => c.setUser(id))
}

/** Truyền vào createRoot: lỗi render React không có error boundary nào bắt */
export function rootErrorOptions() {
  if (!configured) return {}
  return {
    onUncaughtError: (error: unknown, info: ErrorInfo) => {
      console.error(error)
      reportError(error, { componentStack: info.componentStack })
    },
  }
}
