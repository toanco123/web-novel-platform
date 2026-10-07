// Trạng thái của Giọng AI giả (features/tts/api.mock.ts): test đặt `fail` để giả lỗi (hết lượt,
// mất mạng...) và đọc `requests` để xem đã hỏi gì
import type { TtsErrorCode, TtsRequest } from '@/features/tts/shared'

export const ttsMock = {
  fail: null as TtsErrorCode | null,
  requests: [] as TtsRequest[],
  reset() {
    this.fail = null
    this.requests = []
  },
}
