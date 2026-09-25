/** Một trang của danh sách có phân trang */
export type Page<T> = {
  items: T[]
  total: number
  page: number
  pageCount: number
}
