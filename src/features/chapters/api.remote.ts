// Chương cho người đọc từ Supabase. Truyện được lọc qua join `stories!inner(slug)` nên RLS của
// stories áp dụng: người lạ chỉ thấy truyện công khai, chủ truyện thấy cả truyện nháp của mình (xem
// trước, như bản giả). Chủ truyện đọc được mọi chương của mình nên truy vấn nào cũng lọc
// status = 'published': trang đọc và mục lục không hiện chương nháp.
import { getUserId } from '@/features/auth/api'
import { storyBySlug } from '@/features/stories/cards.remote'
import { unwrap } from '@/lib/dbError'
import { loadPage } from '@/lib/dbPage'
import { db } from '@/lib/supabase'
import type { ChapterContent, ChapterNeighbor, ChapterOrder, ChapterSummary } from '@/types/chapter'
import type { Page } from '@/types/page'
import { CHAPTERS_PER_PAGE } from './shared'

/** Chương đã xuất bản luôn có published_at (trigger đặt), lùi về created_at như bản giả */
const publishedAt = (row: { published_at: string | null; created_at: string }) =>
  row.published_at ?? row.created_at

export async function getChapterList(
  slug: string,
  { page = 1, order = 'asc' }: { page?: number; order?: ChapterOrder } = {},
): Promise<Page<ChapterSummary>> {
  // Không thấy truyện thì join không ra dòng nào: trang rỗng như bản giả
  const result = await loadPage(page, CHAPTERS_PER_PAGE, (from, to) =>
    db()
      .from('chapters')
      .select('number, title, published_at, created_at, stories!inner(slug)', { count: 'exact' })
      .eq('stories.slug', slug)
      .eq('status', 'published')
      .order('number', { ascending: order !== 'desc' })
      .range(from, to),
  )
  return {
    ...result,
    items: result.items.map((c) => ({
      number: c.number,
      title: c.title,
      createdAt: publishedAt(c),
    })),
  }
}

/** Chương đã xuất bản `number` của truyện; null nếu không có (hoặc mới là bản nháp) */
async function publishedChapter(slug: string, number: number) {
  return unwrap(
    await db()
      .from('chapters')
      .select('title, content, published_at, created_at, stories!inner(slug)')
      .eq('stories.slug', slug)
      .eq('status', 'published')
      .eq('number', number)
      .maybeSingle(),
  )
}

/** Chương đã xuất bản liền trước/liền sau chương `number` (số chương có thể không liền nhau) */
async function neighbor(
  slug: string,
  number: number,
  side: 'prev' | 'next',
): Promise<ChapterNeighbor | null> {
  const query = db()
    .from('chapters')
    .select('number, title, stories!inner(slug)')
    .eq('stories.slug', slug)
    .eq('status', 'published')
  const row = unwrap(
    await (side === 'prev' ? query.lt('number', number) : query.gt('number', number))
      .order('number', { ascending: side === 'next' })
      .limit(1)
      .maybeSingle(),
  )
  return row ? { number: row.number, title: row.title } : null
}

/** Một chương để đọc, kèm chương trước/sau; null khi không có truyện hoặc chương */
export async function getChapter(slug: string, number: number): Promise<ChapterContent | null> {
  const [story, chapter, prev, next] = await Promise.all([
    storyBySlug(slug),
    publishedChapter(slug, number),
    neighbor(slug, number, 'prev'),
    neighbor(slug, number, 'next'),
  ])
  if (!story || !chapter) return null
  return {
    story: {
      slug: story.slug,
      title: story.title,
      author: story.author,
      status: story.status,
      // Số chương đã xuất bản (story_stats)
      chapterCount: story.chapterCount,
    },
    number,
    title: chapter.title,
    content: chapter.content,
    publishedAt: publishedAt(chapter),
    prev,
    next,
  }
}

// Mỗi người chỉ tính 1 lượt/chương cho mỗi lần tải trang (máy chủ chưa chống đếm trùng)
const counted = new Set<string>()

/** Ghi 1 lượt đọc chương; RPC tự bỏ qua lượt của chính tác giả và chương chưa xuất bản */
export async function recordChapterView(slug: string, number: number) {
  let key: string | undefined
  try {
    key = `${(await getUserId()) ?? ''}|${slug}#${number}`
    if (counted.has(key)) return
    // Đánh dấu trước khi gọi để lần gọi trùng ngay sau đó (vd effect chạy 2 lần) không tính thêm
    counted.add(key)
    const { error } = await db().rpc('record_chapter_view', { p_slug: slug, p_number: number })
    if (error) throw error
  } catch {
    // Lỗi không được làm hỏng việc đọc (bản giả cũng không ném lỗi ở đây); chưa ghi được thì lần mở
    // chương sau thử lại
    if (key) counted.delete(key)
  }
}
