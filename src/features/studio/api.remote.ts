// Khu Sáng tác trên Supabase. Luật của bản giả (truyện chỉ công khai khi có chương đã xuất bản, chương
// công khai cuối cùng, số chương đã xuất bản không đổi...) do trigger/RPC của DB giữ (migration
// catalog, views_rpc); ở đây map lỗi sang StudioError. Truyện của người khác luôn báo not_found.
import type { PostgrestError } from '@supabase/supabase-js'
import { requireUserId, unauthenticated } from '@/features/auth/api'
import { businessCode, isUniqueViolation, unwrap } from '@/lib/dbError'
import { isDataUrl, publicImageUrl, removeImage, uploadImage } from '@/lib/imageUpload'
import { db } from '@/lib/supabase'
import { isUuid } from '@/lib/uuid'
import type { Chapter, ChapterStatus } from '@/types/chapter'
import type { Database } from '@/types/database'
import type { ChapterReport } from '@/types/report'
import type { StoryVisibility } from '@/types/story'
import { CHAPTER_NUMBER_MAX } from './schemas'
import {
  type ChapterInput,
  type FirstChapterInput,
  isStudioErrorCode,
  type MyStory,
  normalizeStoryInput,
  type StoryInput,
  type StoryStats,
  StudioError,
} from './shared'

type StudioStoryRow = Database['public']['Views']['studio_stories']['Row']
type ChapterRow = Database['public']['Tables']['chapters']['Row']

const notFound = () => new StudioError('not_found')

/** Lỗi nghiệp vụ do trigger/RPC ném (mục 4 thiet-ke-database.md); lỗi khác ném nguyên */
function studioError(error: PostgrestError) {
  const code = businessCode(error)
  if (code === 'unauthenticated') return unauthenticated()
  return code && isStudioErrorCode(code) ? new StudioError(code) : null
}

/** Như studioError, thêm trùng số chương (unique story_id + number) */
const chapterError = (error: PostgrestError) =>
  isUniqueViolation(error) ? new StudioError('chapter_exists') : studioError(error)

/** Cột của view đều có kiểu `| null` (Postgres không suy được NOT NULL qua view) */
function toMyStory(row: StudioStoryRow): MyStory {
  return {
    id: row.id!,
    slug: row.slug!,
    title: row.title!,
    description: row.description ?? '',
    genreSlugs: row.genre_slugs ?? [],
    status: row.status!,
    coverUrl: row.cover_path ? publicImageUrl('covers', row.cover_path) : null,
    owner: { id: row.owner_id!, displayName: row.owner_name ?? '' },
    visibility: row.visibility!,
    createdAt: row.created_at!,
    updatedAt: row.updated_at!,
    publishedAt: row.published_at,
    chapterCount: row.chapter_count ?? 0,
    publishedCount: row.published_count ?? 0,
    draftCount: row.draft_count ?? 0,
    views: row.views ?? 0,
    followers: row.followers ?? 0,
    openReports: row.open_reports ?? 0,
    takedown:
      row.taken_down_at && row.takedown_reason
        ? { at: row.taken_down_at, reason: row.takedown_reason }
        : null,
    authorName: row.author_name ?? null,
  }
}

function toChapter(row: ChapterRow): Chapter {
  return {
    id: row.id,
    storyId: row.story_id,
    number: row.number,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }
}

function orNotFound<T>(row: T | null): T {
  if (!row) throw notFound()
  return row
}

/**
 * PostgREST cắt mọi kết quả ở max_rows dòng (supabase/config.toml: 1000), kể cả mảng nhúng như
 * chương của một truyện. Danh sách phải đủ như bản giả thì đọc từng trang PAGE_ROWS dòng (không
 * được lớn hơn max_rows) tới khi gặp trang thiếu; truy vấn phải xếp theo thứ tự cố định.
 */
const PAGE_ROWS = 1000

/** PostgREST báo .range() bắt đầu quá cuối danh sách (HTTP 416) */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

async function allPages<T>(page: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_ROWS) {
    const next = await page(from, from + PAGE_ROWS - 1)
    rows.push(...next)
    if (next.length < PAGE_ROWS) return rows
  }
}

/** Số chương có thể có (số hỏng gõ trên URL thì coi như không có, không gửi lên máy chủ) */
const isChapterNumber = (n: number) => Number.isInteger(n) && n >= 1 && n <= CHAPTER_NUMBER_MAX

/**
 * requireUserId cho thao tác trên một truyện. Id truyện không đúng dạng uuid (gõ tay trên URL) thì
 * báo not_found luôn, không để máy chủ báo lỗi kiểu dữ liệu.
 */
async function requireUserFor(storyId: string) {
  const userId = await requireUserId()
  if (!isUuid(storyId)) throw notFound()
  return userId
}

/** Truyện của người đang đăng nhập; không có hoặc của người khác thì báo not_found */
async function ownStory(storyId: string) {
  const userId = await requireUserFor(storyId)
  const story = orNotFound(
    unwrap(
      await db()
        .from('stories')
        .select('slug, cover_path')
        .eq('id', storyId)
        .eq('owner_id', userId)
        .maybeSingle(),
    ),
  )
  return { userId, story }
}

/** Truyện trong khu Sáng tác (view chỉ có truyện của mình); null nếu không có */
async function findMyStory(id: string): Promise<MyStory | null> {
  const row = unwrap(await db().from('studio_stories').select('*').eq('id', id).maybeSingle())
  return row ? toMyStory(row) : null
}

/**
 * Ảnh bìa trong form → đường dẫn trong bucket covers:
 * - data URL (ảnh vừa chọn): upload, trả kèm `uploaded` để xóa lại nếu lưu lỗi;
 * - null: không có bìa;
 * - URL khác: giữ bìa đang lưu `current` (truyện mới thì chưa có). Form sửa truyện chỉ gửi lại URL
 *   của chính bìa đó; URL khác là form cũ (vd tab khác vừa đổi bìa và đã xóa file cũ), nhận vào thì
 *   truyện trỏ tới file đã xóa rồi xóa nốt bìa đang dùng.
 */
async function resolveCover(userId: string, coverUrl: string | null, current: string | null) {
  if (!coverUrl) return { path: null, uploaded: null }
  if (!isDataUrl(coverUrl)) return { path: current, uploaded: null }
  const path = await uploadImage('covers', userId, coverUrl)
  return { path, uploaded: path }
}

// ── Truyện ──────────────────────────────────────────────────────────────

export async function getMyStories(): Promise<MyStory[]> {
  await requireUserId()
  const rows = unwrap(
    await db().from('studio_stories').select('*').order('updated_at', { ascending: false }),
  )
  return rows.map(toMyStory)
}

export async function getMyStory(id: string): Promise<MyStory | null> {
  await requireUserId()
  return isUuid(id) ? findMyStory(id) : null
}

/**
 * Tạo truyện (nháp), kèm chương đầu tiên nếu người viết đã viết ngay trong form tạo truyện.
 * RPC tạo truyện, thể loại và chương trong một transaction; slug trùng thì thêm -2, -3...
 */
export async function createStory(
  input: StoryInput,
  firstChapter?: FirstChapterInput,
): Promise<MyStory> {
  const userId = await requireUserId()
  const story = normalizeStoryInput(input)
  const cover = await resolveCover(userId, story.coverUrl, null)
  const chapter = firstChapter?.chapter
  const { data, error } = await db()
    .rpc('create_story', {
      p_title: story.title,
      p_description: story.description,
      p_status: story.status,
      p_genres: story.genreSlugs,
      // Không gửi thì là null (truyện chưa có bìa)
      p_cover_path: cover.path ?? undefined,
      p_first_chapter: chapter
        ? { number: chapter.number, title: chapter.title.trim(), content: chapter.content.trim() }
        : null,
      p_publish: firstChapter?.publish ?? false,
      p_author_name: story.authorName ?? undefined,
    })
    .single()
  if (error) {
    await removeImage('covers', cover.uploaded)
    throw studioError(error) ?? error
  }
  return toMyStory(data)
}

export async function updateStory(id: string, input: StoryInput): Promise<MyStory> {
  const { userId, story: current } = await ownStory(id)
  const story = normalizeStoryInput(input)
  const cover = await resolveCover(userId, story.coverUrl, current.cover_path)
  const { data, error } = await db()
    .rpc('update_story', {
      p_id: id,
      p_title: story.title,
      p_description: story.description,
      p_status: story.status,
      p_genres: story.genreSlugs,
      // Không gửi thì là null: bỏ ảnh bìa
      p_cover_path: cover.path ?? undefined,
      // Không gửi thì là null: bỏ bút danh
      p_author_name: story.authorName ?? undefined,
    })
    .single()
  if (error) {
    await removeImage('covers', cover.uploaded)
    throw studioError(error) ?? error
  }
  if (current.cover_path !== cover.path) await removeImage('covers', current.cover_path)
  return toMyStory(data)
}

/** Công khai/ẩn truyện. Trigger chặn công khai khi chưa có chương đã xuất bản và ghi published_at */
async function setVisibility(id: string, visibility: StoryVisibility): Promise<MyStory> {
  await requireUserFor(id)
  const rows = unwrap(
    await db().from('stories').update({ visibility }).eq('id', id).select('id'),
    studioError,
  )
  // RLS bỏ qua truyện của người khác: không dòng nào được sửa
  if (!rows.length) throw notFound()
  return orNotFound(await findMyStory(id))
}

export async function publishStory(id: string): Promise<MyStory> {
  return setVisibility(id, 'published')
}

export async function unpublishStory(id: string): Promise<MyStory> {
  return setVisibility(id, 'draft')
}

/** Chương, bình luận, báo lỗi, lượt đọc, theo dõi... xóa theo truyện (on delete cascade) */
export async function deleteStory(id: string): Promise<void> {
  const { story } = await ownStory(id)
  const rows = unwrap(await db().from('stories').delete().eq('id', id).select('id'), studioError)
  if (!rows.length) throw notFound()
  await removeImage('covers', story.cover_path)
}

// ── Chương ──────────────────────────────────────────────────────────────

export async function getMyChapters(storyId: string): Promise<Chapter[]> {
  const userId = await requireUserFor(storyId)
  // Truyện kèm một trang chương mỗi truy vấn: không thấy truyện (không phải của mình) thì not_found
  const rows = await allPages(async (from, to) => {
    const story = orNotFound(
      unwrap(
        await db()
          .from('stories')
          .select('chapters(*)')
          .eq('id', storyId)
          .eq('owner_id', userId)
          .order('number', { referencedTable: 'chapters' })
          .range(from, to, { referencedTable: 'chapters' })
          .maybeSingle(),
      ),
    )
    return story.chapters
  })
  return rows.map(toChapter)
}

export async function getMyChapter(storyId: string, number: number): Promise<Chapter | null> {
  await ownStory(storyId)
  if (!isChapterNumber(number)) return null
  const row = unwrap(
    await db()
      .from('chapters')
      .select('*')
      .eq('story_id', storyId)
      .eq('number', number)
      .maybeSingle(),
  )
  return row ? toChapter(row) : null
}

/** Số, trạng thái mọi chương của truyện mình (không kèm nội dung), theo số chương */
async function chapterMeta(storyId: string) {
  const userId = await requireUserFor(storyId)
  return allPages(async (from, to) => {
    const story = orNotFound(
      unwrap(
        await db()
          .from('stories')
          .select('chapters(id, number, status, published_at)')
          .eq('id', storyId)
          .eq('owner_id', userId)
          .order('number', { referencedTable: 'chapters' })
          .range(from, to, { referencedTable: 'chapters' })
          .maybeSingle(),
      ),
    )
    return story.chapters
  })
}

/**
 * Tạo chương mới (không truyền `number`) hoặc sửa chương có sẵn (`number` là số hiện tại).
 * `newNumber`: số chương muốn lưu, được bỏ trống số ở giữa (có chương 1 thì viết luôn chương 3).
 * Chương mới mặc định lấy số tiếp theo. Chỉ đổi số được với chương chưa xuất bản lần nào,
 * vì link, lịch sử đọc và bình luận của người đọc đều theo số chương.
 * publish = true thì xuất bản; false thì giữ nguyên trạng thái hiện tại (chương mới là nháp).
 * Kiểm tra trước như bản giả để báo đúng lỗi; DB vẫn chặn lần nữa (unique, trigger) khi hai nơi
 * cùng sửa.
 */
export async function saveChapter(
  storyId: string,
  input: ChapterInput & { number?: number; newNumber?: number },
  { publish = false } = {},
): Promise<Chapter> {
  const chapters = await chapterMeta(storyId)
  const existing =
    input.number === undefined ? undefined : chapters.find((c) => c.number === input.number)
  if (input.number !== undefined && !existing) throw notFound()
  const number = input.newNumber ?? existing?.number ?? (chapters.at(-1)?.number ?? 0) + 1
  if (chapters.some((c) => c.number === number && c.id !== existing?.id)) {
    throw new StudioError('chapter_exists')
  }
  if (existing && number !== existing.number && existing.published_at) {
    throw new StudioError('chapter_number_locked')
  }

  const title = input.title.trim()
  const content = input.content.trim()
  // published_at (lần đầu xuất bản) và updated_at của chương, của truyện do trigger ghi
  const result = existing
    ? await db()
        .from('chapters')
        .update({
          number,
          title,
          content,
          ...(publish && existing.status === 'draft' ? { status: 'published' as const } : {}),
        })
        .eq('id', existing.id)
        .select('*')
    : await db()
        .from('chapters')
        .insert({
          story_id: storyId,
          number,
          title,
          content,
          status: publish ? 'published' : 'draft',
        })
        .select('*')
  const rows = unwrap(result, chapterError)
  if (!rows.length) throw notFound()
  return toChapter(rows[0])
}

export async function setChapterStatus(
  storyId: string,
  number: number,
  status: ChapterStatus,
): Promise<Chapter> {
  await requireUserFor(storyId)
  if (!isChapterNumber(number)) throw notFound()
  // Chương công khai cuối cùng của truyện đang công khai: trigger báo last_published_chapter
  const rows = unwrap(
    await db()
      .from('chapters')
      .update({ status })
      .eq('story_id', storyId)
      .eq('number', number)
      .select('*'),
    studioError,
  )
  // RLS bỏ qua chương của truyện người khác: không dòng nào được sửa
  if (!rows.length) throw notFound()
  return toChapter(rows[0])
}

/** Bình luận, báo lỗi và lượt đọc của chương xóa theo (khóa ngoại on delete cascade) */
export async function deleteChapter(storyId: string, number: number): Promise<void> {
  await requireUserFor(storyId)
  if (!isChapterNumber(number)) throw notFound()
  const rows = unwrap(
    await db().from('chapters').delete().eq('story_id', storyId).eq('number', number).select('id'),
    studioError,
  )
  if (!rows.length) throw notFound()
}

/** Thêm nhiều chương một lúc (nhập file), đánh số tiếp nối sau chương cuối */
export async function importChapters(
  storyId: string,
  items: ChapterInput[],
  publish: boolean,
): Promise<Chapter[]> {
  const chapters = await chapterMeta(storyId)
  if (!items.length) return []
  const start = (chapters.at(-1)?.number ?? 0) + 1
  const rows = unwrap(
    await db()
      .from('chapters')
      .insert(
        items.map((item, i) => ({
          story_id: storyId,
          number: start + i,
          title: item.title.trim(),
          content: item.content.trim(),
          status: publish ? ('published' as const) : ('draft' as const),
        })),
      )
      .select('*'),
    chapterError,
  )
  return rows.map(toChapter).sort((a, b) => a.number - b.number)
}

// ── Thống kê & báo lỗi ──────────────────────────────────────────────────

export async function getStoryStats(storyId: string): Promise<StoryStats> {
  await requireUserFor(storyId)
  // jsonb cùng dạng StoryStats (ngày theo giờ Việt Nam); truyện không phải của mình thì RPC báo
  // not_found. Đổi lại kiểu số cho chắc (bigint, numeric của Postgres).
  const stats = unwrap(
    await db().rpc('studio_story_stats', { p_story_id: storyId }),
    studioError,
  ) as StoryStats | null
  if (!stats) throw notFound()
  return {
    views: Number(stats.views),
    viewsRecent: Number(stats.viewsRecent),
    viewsByDay: stats.viewsByDay.map((d) => ({ day: d.day, views: Number(d.views) })),
    viewsByChapter: stats.viewsByChapter.map((c) => ({
      number: c.number,
      title: c.title,
      views: Number(c.views),
    })),
    followers: Number(stats.followers),
    ratingAvg: Number(stats.ratingAvg),
    ratingCount: Number(stats.ratingCount),
    comments: Number(stats.comments),
  }
}

/** Báo lỗi chương của truyện mình: chưa xử lý trước, rồi mới nhất trước */
export async function getStoryReports(storyId: string): Promise<ChapterReport[]> {
  const { story } = await ownStory(storyId)
  const rows = await allPages(async (from, to) => {
    const result = await db()
      .from('chapter_reports')
      .select(
        'id, chapter_number, reason, note, status, created_at, reporter:profiles!chapter_reports_reporter_id_fkey(id, display_name)',
      )
      .eq('story_id', storyId)
      // Enum report_status xếp theo thứ tự khai báo: open trước resolved
      .order('status')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
    // Trang trước vừa đủ PAGE_ROWS dòng là hết: trang sau có thể bị báo 416 thay vì trả rỗng
    return result.error?.code === RANGE_NOT_SATISFIABLE ? [] : unwrap(result)
  })
  return rows.map((r) => ({
    id: r.id,
    storySlug: story.slug,
    chapterNumber: r.chapter_number,
    reason: r.reason,
    note: r.note,
    reporter: { id: r.reporter.id, displayName: r.reporter.display_name },
    status: r.status,
    createdAt: r.created_at,
  }))
}

export async function setReportStatus(
  storyId: string,
  reportId: string,
  status: ChapterReport['status'],
): Promise<void> {
  // Kiểm tra chủ truyện trước: người gửi báo lỗi cũng được policy cho sửa báo lỗi còn mở của mình
  await ownStory(storyId)
  if (!isUuid(reportId)) throw notFound()
  const rows = unwrap(
    await db()
      .from('chapter_reports')
      .update({ status })
      .eq('id', reportId)
      .eq('story_id', storyId)
      .select('id'),
    // Mở lại báo lỗi cũ khi cùng bạn đọc đã gửi lại đúng báo lỗi đó (cùng chương, cùng lý do) và
    // báo lỗi mới còn mở: index chapter_reports_open_unique chỉ cho một báo lỗi mở như vậy
    (error) =>
      isUniqueViolation(error) ? new StudioError('report_already_open') : studioError(error),
  )
  if (!rows.length) throw notFound()
}
