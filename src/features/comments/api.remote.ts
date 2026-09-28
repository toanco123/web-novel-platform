// Bình luận và chấm điểm trên Supabase (bảng comments, ratings). Tên và ảnh người viết lấy theo hồ
// sơ hiện tại (profiles). Điểm của truyện đọc từ story_cards: trigger của ratings cập nhật
// story_stats ngay khi chấm. RLS chỉ cho viết vào truyện công khai và chương đã xuất bản.
import type { PostgrestError } from '@supabase/supabase-js'
import { AuthError, limitError, requireUser } from '@/features/auth/api'
import { storyIdBySlug } from '@/features/stories/cards.remote'
import { businessCode, unwrap } from '@/lib/dbError'
import { db } from '@/lib/supabase'
import type { Comment, RatingSummary, Score } from '@/types/comment'
import { COMMENTS_PER_PAGE, type CommentPage } from './shared'

const COMMENT_COLUMNS =
  'id, chapter_number, content, created_at, user:profiles!comments_user_id_fkey(id, display_name, avatar_url)'

type CommentRow = {
  id: string
  chapter_number: number | null
  content: string
  created_at: string
  user: { id: string; display_name: string; avatar_url: string | null }
}

/** PostgREST báo .range() bắt đầu quá cuối danh sách (HTTP 416) */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

// Truyện không còn thấy được, hoặc RLS chặn ghi vì truyện/chương chưa công khai. Dùng AuthError để
// form hiện được lời báo (authErrorMessage chỉ hiện lời của AuthError, lỗi khác báo mất mạng)
const commentsClosed = () =>
  new AuthError(
    'unknown',
    'Truyện hoặc chương này chưa công khai hoặc đã bị gỡ, nên chưa bình luận được.',
  )
const ratingClosed = () =>
  new AuthError('unknown', 'Truyện này chưa công khai hoặc đã bị gỡ, nên chưa chấm điểm được.')

/** Lỗi 42501 (RLS chặn ghi) → lỗi `closed`; lỗi khác giữ nguyên */
const whenBlocked = (closed: () => Error) => (error: PostgrestError) =>
  error.code === '42501' ? closed() : null

function toComment(row: CommentRow, slug: string): Comment {
  return {
    id: row.id,
    storySlug: slug,
    chapterNumber: row.chapter_number,
    user: { id: row.user.id, displayName: row.user.display_name, avatarUrl: row.user.avatar_url },
    content: row.content,
    createdAt: row.created_at,
  }
}

/** Bình luận của truyện (chapter = null) hoặc của một chương, kèm tổng số; head: chỉ đếm */
function commentsOf(storyId: string, chapter: number | null, head = false) {
  const query = db()
    .from('comments')
    .select(COMMENT_COLUMNS, { count: 'exact', head })
    .eq('story_id', storyId)
  return chapter === null ? query.is('chapter_number', null) : query.eq('chapter_number', chapter)
}

/** Bình luận của truyện (chapter = null, mặc định) hoặc của một chương, mới nhất trước */
export async function getComments(
  slug: string,
  { chapter = null, cursor = 0 }: { chapter?: number | null; cursor?: number } = {},
): Promise<CommentPage> {
  const storyId = await storyIdBySlug(slug)
  if (!storyId) return { items: [], total: 0, nextCursor: null }
  const result = await commentsOf(storyId, chapter)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(cursor, cursor + COMMENTS_PER_PAGE - 1)
  if (result.error?.code === RANGE_NOT_SATISFIABLE) {
    // Con trỏ đã quá cuối (bình luận bị xóa giữa hai lần tải): trang rỗng như bản giả
    const counted = await commentsOf(storyId, chapter, true)
    unwrap(counted)
    return { items: [], total: counted.count ?? 0, nextCursor: null }
  }
  const items = unwrap(result).map((row) => toComment(row, slug))
  const total = result.count ?? 0
  const next = cursor + items.length
  return { items, total, nextCursor: next < total ? next : null }
}

export async function addComment(
  slug: string,
  content: string,
  chapter: number | null = null,
): Promise<Comment> {
  await requireUser()
  const storyId = await storyIdBySlug(slug)
  if (!storyId) throw commentsClosed()
  // user_id do DB đặt (auth.uid()); chỉ gửi các cột được cấp quyền ghi
  const row = unwrap(
    await db()
      .from('comments')
      .insert({ story_id: storyId, chapter_number: chapter, content: content.trim() })
      .select(COMMENT_COLUMNS)
      .single(),
    (error) => limitError(businessCode(error)) ?? whenBlocked(commentsClosed)(error),
  )
  return toComment(row, slug)
}

/** Chỉ xóa được bình luận của chính mình; không có bình luận đó thì bỏ qua */
export async function deleteComment(id: string) {
  const user = await requireUser()
  unwrap(await db().from('comments').delete().eq('id', id).eq('user_id', user.id))
}

export async function getRatingSummary(slug: string): Promise<RatingSummary> {
  const row = unwrap(
    await db()
      .from('story_cards')
      .select('rating_avg, rating_count, rating_counts')
      .eq('slug', slug)
      .maybeSingle(),
  )
  // rating_counts[0] là số lượt 1 sao, ..., [4] là số lượt 5 sao
  const [d1 = 0, d2 = 0, d3 = 0, d4 = 0, d5 = 0] = row?.rating_counts ?? []
  return {
    average: Number(row?.rating_avg ?? 0),
    count: row?.rating_count ?? 0,
    distribution: { 1: d1, 2: d2, 3: d3, 4: d4, 5: d5 },
  }
}

export async function getMyRating(slug: string): Promise<Score | null> {
  const user = await requireUser()
  const row = unwrap(
    await db()
      .from('ratings')
      .select('score, stories!inner(slug)')
      .eq('user_id', user.id)
      .eq('stories.slug', slug)
      .maybeSingle(),
  )
  return row ? (row.score as Score) : null
}

/** Chấm lại thì thay điểm cũ (mỗi người một điểm cho mỗi truyện) */
export async function rateStory(slug: string, score: Score) {
  await requireUser()
  const storyId = await storyIdBySlug(slug)
  if (!storyId) throw ratingClosed()
  unwrap(
    await db()
      .from('ratings')
      .upsert({ story_id: storyId, score }, { onConflict: 'user_id,story_id' }),
    whenBlocked(ratingClosed),
  )
  return score
}
