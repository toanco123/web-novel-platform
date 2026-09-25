// Đọc/ghi localStorage cho dữ liệu giả (chỉ dùng trong các api.ts giai đoạn mock)

export function readMock<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeMock(key: string, value: unknown) {
  try {
    writeMockStrict(key, value)
  } catch {
    // localStorage bị chặn (chế độ riêng tư...): dữ liệu chỉ sống tới khi tải lại trang
  }
}

export class StorageFullError extends Error {
  constructor() {
    super(
      'Bộ nhớ trình duyệt đã đầy. Đây là giới hạn của bản thử nghiệm, sẽ không còn khi nối máy chủ.',
    )
    this.name = 'StorageFullError'
  }
}

/** Như writeMock nhưng báo lỗi khi bộ nhớ đầy (dùng cho dữ liệu lớn: truyện, chương, ảnh bìa) */
export function writeMockStrict(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new StorageFullError()
    }
    throw error
  }
}

export const mockDelay = (ms = 250) => new Promise((r) => setTimeout(r, ms))
