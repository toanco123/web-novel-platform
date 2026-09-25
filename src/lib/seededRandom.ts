/** Số ngẫu nhiên cố định theo chuỗi seed (dùng cho dữ liệu giả để mỗi lần tải giống nhau) */
export function seededRandom(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export const pick = <T>(rand: () => number, list: readonly T[]) =>
  list[Math.floor(rand() * list.length)]
