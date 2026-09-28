// Phần dùng chung của hai backend góp ý (api.mock.ts, api.remote.ts)
import type { ReportReason } from '@/types/report'

/** Báo lỗi một chương; note được bỏ khoảng trắng ở hai đầu khi lưu */
export type ReportChapterInput = {
  slug: string
  chapter: number
  reason: ReportReason
  note: string
}
