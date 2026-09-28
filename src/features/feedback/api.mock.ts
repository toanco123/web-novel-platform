// Góp ý giả lưu trong localStorage (báo lỗi ở src/mocks/activity.ts): dùng cho test tự động và khi
// chạy không có Supabase (xem api.ts). Bản thật: api.remote.ts.
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay, readMock, writeMock } from '@/lib/mockStorage'
import { loadReports, saveReports } from '@/mocks/activity'
import type { ChapterReport } from '@/types/report'
import type { ContactValues } from './schemas'
import type { ReportChapterInput } from './shared'

const CONTACT_KEY = 'mock-contact-messages'

export async function sendContactMessage(input: ContactValues) {
  await delay(600)
  const messages = readMock<(ContactValues & { sentAt: string })[]>(CONTACT_KEY, [])
  writeMock(CONTACT_KEY, [...messages, { ...input, sentAt: new Date().toISOString() }])
}

/**
 * Báo lỗi một chương (cần đăng nhập). Cùng người, cùng chương, cùng lý do mà báo lỗi cũ
 * chưa xử lý thì chỉ cập nhật ghi chú, không tạo thêm.
 */
export async function reportChapter(input: ReportChapterInput): Promise<ChapterReport> {
  await delay(400)
  const user = await requireUser()
  const reports = loadReports()
  const existing = reports.find(
    (r) =>
      r.status === 'open' &&
      r.reporter.id === user.id &&
      r.storySlug === input.slug &&
      r.chapterNumber === input.chapter &&
      r.reason === input.reason,
  )
  const report: ChapterReport = existing
    ? { ...existing, note: input.note.trim(), createdAt: new Date().toISOString() }
    : {
        id: crypto.randomUUID(),
        storySlug: input.slug,
        chapterNumber: input.chapter,
        reason: input.reason,
        note: input.note.trim(),
        reporter: { id: user.id, displayName: user.displayName },
        status: 'open',
        createdAt: new Date().toISOString(),
      }
  saveReports(existing ? reports.map((r) => (r === existing ? report : r)) : [report, ...reports])
  return report
}
