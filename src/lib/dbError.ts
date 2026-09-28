// Đọc lỗi trả về từ Supabase (PostgREST) trong các api.remote.ts.
// Mã lỗi nghiệp vụ và ý nghĩa: mục 4 documents/thiet-ke-database.md
import type { PostgrestError } from '@supabase/supabase-js'

/** Trigger/RPC ném lỗi nghiệp vụ bằng `raise exception '<mã>'` (SQLSTATE P0001) */
export function businessCode(error: PostgrestError | null | undefined): string | null {
  return error?.code === 'P0001' ? error.message : null
}

/** Trùng khóa unique (vd trùng số chương, trùng thể loại) */
export const isUniqueViolation = (error: PostgrestError | null | undefined) =>
  error?.code === '23505'

/**
 * Trả về data, hoặc ném lỗi: `mapError` đổi lỗi DB sang lỗi của feature (StudioError, AuthError...);
 * trả null/undefined thì ném nguyên lỗi (UI hiện thông báo chung).
 */
export function unwrap<R extends { data: unknown; error: PostgrestError | null }>(
  result: R,
  mapError?: (error: PostgrestError) => Error | null | undefined,
): SuccessData<R> {
  if (result.error) throw mapError?.(result.error) ?? result.error
  return result.data as SuccessData<R>
}

/** Kiểu data của nhánh thành công (error = null) của một response PostgREST */
type SuccessData<R> = Extract<R, { error: null }> extends { data: infer D } ? D : never
