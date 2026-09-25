// Nơi DUY NHẤT gửi góp ý của người dùng: tin nhắn liên hệ và báo lỗi chương.
// Giai đoạn UI lưu localStorage; báo lỗi của truyện người dùng đăng hiện ở khu Sáng tác của tác giả.
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay, readMock, writeMock } from '@/lib/mockStorage'
import { loadReports, saveReports } from '@/mocks/activity'
import type { ChapterReport, ReportReason } from '@/types/report'
import type { ContactValues } from './schemas'

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
export async function reportChapter(input: {
  slug: string
  chapter: number
  reason: ReportReason
  note: string
}): Promise<ChapterReport> {
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
