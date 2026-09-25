import { useEffect, useState } from 'react'

/** Giá trị chỉ cập nhật sau khi ngừng thay đổi `delay` ms (vd ô tìm kiếm gợi ý) */
export function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
