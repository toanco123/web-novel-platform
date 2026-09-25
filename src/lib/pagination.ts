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
