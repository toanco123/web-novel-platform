// Phân trang truy vấn Supabase có đếm tổng, dùng trong các api.remote.ts
import type { PostgrestResponse } from '@supabase/supabase-js'
import type { Page } from '@/types/page'
import { unwrap } from './dbError'

/**
 * Một trang của truy vấn có đếm tổng (`count: 'exact'`), kẹp số trang như paginate() (vd link
 * ?page= cũ khi danh sách đã ngắn lại). Thường trang được hỏi hợp lệ nên chỉ cần 1 lần gọi; trang
 * ngoài khoảng thì gọi lại trang gần nhất.
 */
export async function loadPage<T>(
  page: number,
  perPage: number,
  load: (from: number, to: number) => PromiseLike<PostgrestResponse<T>>,
): Promise<Page<T>> {
  const read = async (p: number): Promise<Page<T>> => {
    const from = (p - 1) * perPage
    const result = await load(from, from + perPage - 1)
    // Vị trí bắt đầu vượt quá tổng số dòng: PostgREST trả lỗi 416 (PGRST103) không kèm tổng, nên
    // đọc trang 1 để biết tổng
    if (result.error?.code === 'PGRST103' && p > 1) return read(1)
    const items = unwrap(result)
    const total = result.count ?? 0
    return { items, total, page: p, pageCount: Math.max(1, Math.ceil(total / perPage)) }
  }
  const wanted = Math.max(1, Math.floor(page) || 1)
  // Số trang lớn tới mức offset không còn là số nguyên chính xác (vd ?page=Infinity, ?page=1e18)
  // thì đọc trang 1 trước để biết tổng
  const first = await read(Number.isSafeInteger(wanted * perPage) ? wanted : 1)
  const current = Math.min(wanted, first.pageCount)
  return current === first.page ? first : read(current)
}
