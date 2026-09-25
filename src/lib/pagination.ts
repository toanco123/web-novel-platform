import type { Page } from '@/types/page'

/**
 * Danh sách số trang để hiển thị, với "…" ở chỗ bị lược.
 * vd pageList(5, 9) → [1, '…', 4, 5, 6, '…', 9]
 */
export function pageList(current: number, total: number, siblings = 1): (number | '…')[] {
  const pages = new Set([1, total])
  for (let p = current - siblings; p <= current + siblings; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const result: (number | '…')[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && p - prev === 2) result.push(prev + 1)
    else if (prev !== undefined && p - prev > 2) result.push('…')
    result.push(p)
  })
  return result
}

/** Cắt một trang từ danh sách; số trang ngoài khoảng được kẹp về trang gần nhất */
export function paginate<T>(all: T[], page: number, perPage: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / perPage))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount)
  const start = (current - 1) * perPage
  return { items: all.slice(start, start + perPage), total: all.length, page: current, pageCount }
}
