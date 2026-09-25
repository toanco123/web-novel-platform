import type { ReadingProgress } from '@/types/library'

/** state của link "Đọc tiếp": trang đọc cuộn tới vị trí đã lưu (tỉ lệ 0–1 trong chương) */
export type ResumeState = { resume: number }

export const resumeState = (progress: ReadingProgress): ResumeState => ({
  resume: progress.progress,
})

export function readResumeState(state: unknown): number | null {
  const value = (state as Partial<ResumeState> | null)?.resume
  return typeof value === 'number' ? value : null
}
