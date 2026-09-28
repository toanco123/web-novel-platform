// Góp ý trên Supabase: tin nhắn liên hệ (bảng contact_messages, chỉ ghi, xem trên Dashboard) và báo
// lỗi chương (RPC report_chapter). Báo lỗi hiện ở khu Sáng tác của chủ truyện.
import type { PostgrestError } from '@supabase/supabase-js'
import { AuthError, requireUser, unauthenticated } from '@/features/auth/api'
import { businessCode, unwrap } from '@/lib/dbError'
import { db } from '@/lib/supabase'
import type { ChapterReport } from '@/types/report'
import type { ContactValues } from './schemas'
import type { ReportChapterInput } from './shared'

/** Khách cũng gửi được; user_id do DB đặt (auth.uid(), khách là null) */
export async function sendContactMessage(input: ContactValues) {
  const { name, email, topic, message } = input
  // Chỉ gửi các cột được cấp quyền ghi. Không kèm .select(): không ai có quyền đọc lại bảng này
  unwrap(await db().from('contact_messages').insert({ name, email, topic, message }))
}

// Không thấy truyện, hoặc RLS chặn ghi vì chương không có/chưa xuất bản/truyện chưa công khai. Dùng
// AuthError để hộp thoại hiện được lời báo (authErrorMessage chỉ hiện lời của AuthError, lỗi khác
// báo mất mạng)
const reportClosed = () =>
  new AuthError(
    'unknown',
    'Truyện hoặc chương này chưa công khai hoặc đã bị gỡ, nên chưa báo lỗi được.',
  )

/** Mã lỗi của report_chapter (mục 4 documents/thiet-ke-database.md); lỗi khác giữ nguyên */
function reportError(error: PostgrestError) {
  const code = businessCode(error)
  if (code === 'unauthenticated') return unauthenticated()
  return code === 'not_found' || error.code === '42501' ? reportClosed() : null
}

/**
 * Báo lỗi một chương (cần đăng nhập). Cùng người, cùng chương, cùng lý do mà báo lỗi cũ chưa xử lý
 * thì RPC chỉ cập nhật ghi chú (và thời điểm báo), không tạo thêm.
 */
export async function reportChapter(input: ReportChapterInput): Promise<ChapterReport> {
  const user = await requireUser()
  const row = unwrap(
    await db().rpc('report_chapter', {
      p_slug: input.slug,
      p_chapter: input.chapter,
      p_reason: input.reason,
      p_note: input.note.trim(),
    }),
    reportError,
  )
  return {
    id: row.id,
    storySlug: input.slug,
    chapterNumber: row.chapter_number,
    reason: row.reason,
    note: row.note,
    reporter: { id: user.id, displayName: user.displayName },
    status: row.status,
    createdAt: row.created_at,
  }
}
