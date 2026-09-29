import { usePendingProgressSync } from '../hooks'

/** Gắn một lần trong Providers: gửi lịch sử đọc ghi lúc mất mạng khi có mạng lại */
export function OfflineSync() {
  usePendingProgressSync()
  return null
}
