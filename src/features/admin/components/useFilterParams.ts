import { useSearchParams } from 'react-router'

/**
 * Bộ lọc và trang của bảng quản trị nằm trên URL. update({ q: 'abc' }) đổi bộ lọc và quay về
 * trang 1; null/'' thì bỏ tham số đó.
 */
export function useFilterParams() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)

  const update = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!('page' in changes)) next.delete('page')
      for (const [key, value] of Object.entries(changes)) {
        if (value && !(key === 'page' && value === '1')) next.set(key, value)
        else next.delete(key)
      }
      return next
    })

  return { params, page, update }
}
