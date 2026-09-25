export type ReportReason = 'typo' | 'missing' | 'order' | 'violation' | 'other'

export type ReportStatus = 'open' | 'resolved'

export type ChapterReport = {
  id: string
  storySlug: string
  chapterNumber: number
  reason: ReportReason
  note: string
  reporter: { id: string; displayName: string }
  status: ReportStatus
  createdAt: string
}
