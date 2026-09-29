// Nhập truyện hàng loạt (/admin/import): mỗi file .txt là một truyện, tách chương bằng parseChapters
// của khu Sáng tác. Việc ghi dùng lại api của khu Sáng tác (createStory → importChapters →
// publishStory) nên chạy được với cả Supabase lẫn bản giả; truyện thuộc tài khoản admin đang đăng
// nhập, tác giả gốc ghi ở authorName.
import { type ParsedChapter, parseChapters, readChapterFile } from '@/features/studio/parseChapters'
import * as studio from '@/features/studio/api'
import { DESCRIPTION_MAX, storySchema } from '@/features/studio/schemas'
import type { StoryStatus } from '@/types/story'

export const BULK_MAX_FILES = 50

export type BulkStoryDraft = {
  /** Khóa của hàng (tên file có thể trùng giữa các lần chọn) */
  key: string
  fileName: string
  title: string
  authorName: string
  genreSlugs: string[]
  status: StoryStatus
  description: string
  chapters: ParsedChapter[]
  warnings: string[]
}

/** "Chi_Pheo - Nam Cao.txt" → "Chi Pheo - Nam Cao" */
export const titleFromFileName = (name: string) =>
  name
    .replace(/\.txt$/i, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Đọc một file thành bản nháp truyện; lời mở đầu (trước "Chương 1") điền sẵn làm giới thiệu */
export async function readStoryFile(file: File, key: string): Promise<BulkStoryDraft> {
  const { chapters, warnings, preface } = parseChapters(await readChapterFile(file))
  return {
    key,
    fileName: file.name,
    title: titleFromFileName(file.name).slice(0, 120),
    authorName: '',
    genreSlugs: [],
    status: 'completed',
    description: preface.slice(0, DESCRIPTION_MAX),
    chapters,
    // Lời mở đầu đã thành giới thiệu, không còn bị bỏ qua
    warnings: preface ? warnings.filter((w) => !w.includes('trước chương đầu tiên')) : warnings,
  }
}

/** Chương nhập được (chương quá ngắn/dài bị bỏ qua) */
export const importableChapters = (draft: BulkStoryDraft) =>
  draft.chapters.filter((c) => !c.problem)

/** Lỗi theo từng trường cần sửa trước khi nhập; rỗng: nhập được */
export function draftErrors(draft: BulkStoryDraft): Partial<Record<keyof BulkStoryDraft, string>> {
  const errors: Partial<Record<keyof BulkStoryDraft, string>> = {}
  const result = storySchema.safeParse({ ...draft, coverUrl: null })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof BulkStoryDraft
      errors[field] ??= issue.message
    }
  }
  if (importableChapters(draft).length === 0) {
    errors.chapters = 'Không có chương nào nhập được (file rỗng hoặc mọi chương quá ngắn/dài).'
  }
  return errors
}

/** Lỗi khi nhập một truyện; storyId có khi truyện đã được tạo (nháp) trước lúc lỗi */
export class BulkImportError extends Error {
  storyId: string | null
  constructor(message: string, storyId: string | null) {
    super(message)
    this.name = 'BulkImportError'
    this.storyId = storyId
  }
}

export type BulkImportResult = { id: string; slug: string; chapters: number; skipped: number }

/** Tạo truyện, thêm các chương (đã xuất bản) rồi công khai truyện */
export async function importStory(draft: BulkStoryDraft): Promise<BulkImportResult> {
  const chapters = importableChapters(draft)
  const story = await studio.createStory({
    title: draft.title,
    description: draft.description,
    genreSlugs: draft.genreSlugs,
    status: draft.status,
    coverUrl: null,
    authorName: draft.authorName,
  })
  try {
    await studio.importChapters(
      story.id,
      chapters.map((c) => ({ title: c.title, content: c.content })),
      true,
    )
    await studio.publishStory(story.id)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Lỗi không rõ.'
    throw new BulkImportError(
      `Đã tạo truyện (nháp) nhưng chưa nhập xong chương: ${reason}`,
      story.id,
    )
  }
  return {
    id: story.id,
    slug: story.slug,
    chapters: chapters.length,
    skipped: draft.chapters.length - chapters.length,
  }
}
