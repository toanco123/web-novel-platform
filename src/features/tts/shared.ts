// Phần dùng chung của hai backend Giọng AI (api.mock.ts, api.remote.ts). App di động chép nguyên.
// Kiểu request / manifest giống hàm Vercel api/_lib/tts.ts. Plan: documents/plan-giong-ai.md

export type TtsRequest = {
  slug: string
  chapter: number
  /** id trong TTS_VOICES (src/lib/ttsVoices.ts) */
  voice: string
  /** Số đoạn client đếm được (bỏ trống khi chưa tải chương, vd tạo sẵn chương sau) */
  total?: number
  /** Chỉ số các đoạn cần tạo nếu chưa có (tối đa TTS_MAX_GENERATE) */
  generate: number[]
  /** Tạo cả tên chương */
  title: boolean
}

export type TtsManifest = {
  total: number
  /** Địa chỉ các phần của tên chương; null: chưa có (hoặc request không hỏi) */
  title: string[] | null
  /** Mỗi đoạn: địa chỉ các phần theo thứ tự ([] khi đoạn không có chữ); null: chưa có */
  paragraphs: (string[] | null)[]
}

export const TTS_MAX_GENERATE = 4

export type TtsErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'content_changed'
  | 'tts_daily_quota'
  | 'tts_month_quota'
  | 'tts_unavailable'
  | 'network'
  | 'unknown'

const MESSAGES: Record<TtsErrorCode, string> = {
  unauthenticated: 'Đăng nhập để nghe bằng Giọng AI.',
  not_found: 'Chương này chưa nghe được bằng Giọng AI.',
  content_changed: 'Chương vừa được tác giả sửa nên Giọng AI chưa đọc được.',
  tts_daily_quota: 'Bạn đã dùng hết lượt Giọng AI hôm nay.',
  tts_month_quota: 'Giọng AI đã hết lượt của tháng này.',
  tts_unavailable: 'Giọng AI đang gặp sự cố.',
  network: 'Mất kết nối nên Giọng AI không đọc được.',
  unknown: 'Giọng AI đang gặp sự cố.',
}

export class TtsError extends Error {
  code: TtsErrorCode
  constructor(code: TtsErrorCode) {
    super(MESSAGES[code])
    this.name = 'TtsError'
    this.code = code
  }
}

const KNOWN = new Set<string>(Object.keys(MESSAGES))
export const toTtsCode = (code: unknown): TtsErrorCode =>
  typeof code === 'string' && KNOWN.has(code) ? (code as TtsErrorCode) : 'unknown'

/** Câu báo khi chuyển sang giọng của máy */
export function ttsFallbackMessage(error: unknown, continued: boolean) {
  const reason = error instanceof TtsError ? error.message : MESSAGES.unknown
  return continued ? `${reason} Đang đọc tiếp bằng giọng của máy.` : reason
}
