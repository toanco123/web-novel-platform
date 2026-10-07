// Phần nặng của theo dõi lỗi: thư viện Sentry. Chỉ monitoring.ts tải file này (import động, sau lúc
// mở trang); nơi khác gọi qua monitoring.ts
import * as Sentry from '@sentry/react'
import { scrubBreadcrumb, scrubEvent, shouldSendEvent } from './errorFilter'

export function start(dsn: string) {
  Sentry.init({
    dsn,
    release: __APP_VERSION__,
    environment: __SENTRY_ENV__,
    // Chỉ gắn id người dùng (setUser); không lấy IP, cookie, body
    dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
    // Lỗi do trình duyệt hoặc tiện ích cài thêm, không phải lỗi của web
    ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured'],
    beforeSend: (event, hint) => {
      if (!shouldSendEvent(event, hint)) return null
      scrubEvent(event)
      return event
    },
    beforeBreadcrumb: (breadcrumb) => {
      scrubBreadcrumb(breadcrumb)
      return breadcrumb
    },
  })
}

export const capture = (error: Error, extra: Record<string, unknown>) =>
  Sentry.captureException(error, { extra })

export const setUser = (id: string | null) => Sentry.setUser(id ? { id } : null)
