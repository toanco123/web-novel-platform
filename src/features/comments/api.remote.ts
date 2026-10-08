// Bình luận và chấm điểm trên Supabase (bảng comments, ratings). Tên và ảnh người viết lấy theo hồ
// sơ hiện tại (profiles). Điểm của truyện đọc từ story_cards: trigger của ratings cập nhật
// story_stats ngay khi chấm. RLS chỉ cho viết vào truyện công khai và chương đã xuất bản.
// Bình luận gốc đọc qua RPC comment_threads (kèm số trả lời); trả lời đọc thẳng bảng comments.
// Lượt thích: bảng comment_likes (RLS chỉ trả lượt thích của mình), số đếm comments.like_count do
// trigger ghi. Chủ truyện xóa được mọi bình luận trong truyện của mình (policy xóa).
import type { PostgrestError } from '@supabase/supabase-js'
import { AuthError, limitError, requireUser, unauthenticated } from '@/features/auth/api'
import { storyIdBySlug } from '@/features/stories/cards.remote'
import { businessCode, isUniqueViolation, unwrap } from '@/lib/dbError'
import { db } from '@/lib/supabase'
import { isUuid } from '@/lib/uuid'
import type { Comment, CommentSort, RatingSummary, Score } from '@/types/comment'
import type { Database } from '@/types/database'
import {
  commentGone,
  COMMENTS_PER_PAGE,
  type CommentPage,
  invalidParent,
  ownCommentLike,
  ownCommentReport,
  parentDeleted,
  REPLIES_LIMIT,
  type ReportCommentInput,
} from './shared'

// my_like: lượt thích của chính người xem (RLS của comment_likes), khách: mảng rỗng
const COMMENT_COLUMNS =
  'id, chapter_number, content, created_at, parent_id, like_count, edited_at, story:stories!inner(slug, owner_id, author_name), user:profiles!comments_user_id_fkey(id, display_name, avatar_url), my_like:comment_likes(user_id)'

type CommentRow = {
  id: string
  chapter_number: number | null
  content: string
  created_at: string
  parent_id: string | null
  like_count: number
  edited_at: string | null
  story: { slug: string; owner_id: string; author_name: string | null }
  user: { id: string; display_name: string; avatar_url: string | null }
  my_like: { user_id: string }[]
}

type ThreadRow = Database['public']['Functions']['comment_threads']['Returns'][number]

/** PostgREST báo .range() bắt đầu quá cuối danh sách (HTTP 416) */
const RANGE_NOT_SATISFIABLE = 'PGRST103'
/** Vi phạm khóa ngoại: bình luận gốc bị xóa đúng lúc đang gửi trả lời (hoặc lúc đang thích) */
const FOREIGN_KEY_VIOLATION = '23503'

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

/** Một trả lời, hoặc bình luận vừa gửi / vừa sửa (replyCount luôn 0: không dùng ở hai chỗ đó) */
function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    storySlug: row.story.slug,
    chapterNumber: row.chapter_number,
    user: { id: row.user.id, displayName: row.user.display_name, avatarUrl: row.user.avatar_url },
    content: row.content,
    createdAt: row.created_at,
    parentId: row.parent_id,
    replyCount: 0,
    likeCount: row.like_count,
    likedByMe: row.my_like.length > 0,
    editedAt: row.edited_at,
    // Như is_author của comment_threads: truyện có bút danh thì không gắn nhãn
    isAuthor: row.user.id === row.story.owner_id && !row.story.author_name,
  }
}

function threadToComment(row: ThreadRow, slug: string): Comment {
  return {
    id: row.id,
    storySlug: slug,
    // Kiểu sinh ra của hàm không có null; thực tế hai cột này có thể null
    chapterNumber: row.chapter_number ?? null,
    user: { id: row.user_id, displayName: row.display_name, avatarUrl: row.avatar_url ?? null },
    content: row.content,
    createdAt: row.created_at,
    parentId: null,
    replyCount: row.reply_count,
    likeCount: row.like_count,
    likedByMe: row.liked_by_me,
    editedAt: row.edited_at ?? null,
    isAuthor: row.is_author,
  }
}

/** Bình luận gốc của truyện (chapter = null) hoặc của một chương, kèm tổng số; head: chỉ đếm */
const threadsOf = (storyId: string, chapter: number | null, head = false) =>
  db().rpc(
    'comment_threads',
    { p_story_id: storyId, p_chapter: chapter ?? undefined },
    { count: 'exact', head },
  )

/**
 * Bình luận gốc của truyện (chapter = null, mặc định) hoặc của một chương; mỗi bình luận kèm số
 * trả lời. sort: mới nhất trước (mặc định) | nhiều lượt thích trước
 */
export async function getComments(
  slug: string,
  {
    chapter = null,
    cursor = 0,
    sort = 'newest',
  }: { chapter?: number | null; cursor?: number; sort?: CommentSort } = {},
): Promise<CommentPage> {
  const storyId = await storyIdBySlug(slug)
  if (!storyId) return { items: [], total: 0, nextCursor: null }
  let query = threadsOf(storyId, chapter)
  if (sort === 'top') query = query.order('like_count', { ascending: false })
  const result = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(cursor, cursor + COMMENTS_PER_PAGE - 1)
  if (result.error?.code === RANGE_NOT_SATISFIABLE) {
    // Con trỏ đã quá cuối (bình luận bị xóa giữa hai lần tải): trang rỗng như bản giả
    const counted = await threadsOf(storyId, chapter, true)
    unwrap(counted)
    return { items: [], total: counted.count ?? 0, nextCursor: null }
  }
  const items = unwrap(result).map((row) => threadToComment(row, slug))
  const total = result.count ?? 0
  const next = cursor + items.length
  return { items, total, nextCursor: next < total ? next : null }
}

/** Trả lời của một bình luận, cũ nhất trước */
export async function getReplies(commentId: string): Promise<Comment[]> {
  if (!isUuid(commentId)) return []
  const rows = unwrap(
    await db()
      .from('comments')
      .select(COMMENT_COLUMNS)
      .eq('parent_id', commentId)
      .order('created_at')
      .order('id')
      .limit(REPLIES_LIMIT),
  )
  return rows.map(toComment)
}

/** Lỗi khi gửi trả lời: bình luận gốc đã bị xóa, hoặc không nhận trả lời (trigger comments_check_parent) */
function parentError(error: PostgrestError) {
  const code = businessCode(error)
  if (code === 'parent_not_found' || error.code === FOREIGN_KEY_VIOLATION) return parentDeleted()
  return code === 'invalid_parent' ? invalidParent() : null
}

/** parentId có giá trị: trả lời bình luận gốc đó (cùng truyện, cùng chương) */
export async function addComment(
  slug: string,
  content: string,
  chapter: number | null = null,
  parentId: string | null = null,
): Promise<Comment> {
  await requireUser()
  if (parentId && !isUuid(parentId)) throw parentDeleted()
  const storyId = await storyIdBySlug(slug)
  if (!storyId) throw commentsClosed()
  // user_id do DB đặt (auth.uid()); chỉ gửi các cột được cấp quyền ghi
  const row = unwrap(
    await db()
      .from('comments')
      .insert({
        story_id: storyId,
        chapter_number: chapter,
        content: content.trim(),
        parent_id: parentId,
      })
      .select(COMMENT_COLUMNS)
      .single(),
    (error) =>
      limitError(businessCode(error)) ?? parentError(error) ?? whenBlocked(commentsClosed)(error),
  )
  return toComment(row)
}

/**
 * Sửa bình luận của chính mình khi truyện còn công khai; DB đặt edited_at khi nội dung đổi. Không
 * có bình luận đó, của người khác, hay truyện đã ẩn thì báo bình luận không còn
 */
export async function editComment(commentId: string, content: string): Promise<Comment> {
  await requireUser()
  if (!isUuid(commentId)) throw commentGone()
  const row = unwrap(
    await db()
      .from('comments')
      .update({ content: content.trim() })
      .eq('id', commentId)
      .select(COMMENT_COLUMNS)
      .maybeSingle(),
    whenBlocked(commentGone),
  )
  if (!row) throw commentGone()
  return toComment(row)
}

/** Mã lỗi khi thích (trigger comment_likes_guard); 42501: truyện không còn công khai */
function likeError(error: PostgrestError) {
  const code = businessCode(error)
  if (code === 'own_comment_like') return ownCommentLike()
  if (code === 'not_found' || error.code === FOREIGN_KEY_VIOLATION) return commentGone()
  return limitError(code) ?? whenBlocked(commentGone)(error)
}

/**
 * Thích (liked = true) hoặc bỏ thích bình luận của người khác trong truyện đang công khai. Thích
 * lại khi đã thích, hay bỏ thích khi chưa thích, không làm gì. Tối đa 300 lượt thích mới / giờ.
 */
export async function setCommentLike(commentId: string, liked: boolean) {
  const user = await requireUser()
  if (!isUuid(commentId)) throw commentGone()
  if (!liked) {
    unwrap(
      await db().from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id),
    )
    return
  }
  // user_id do DB đặt (auth.uid()); chỉ gửi cột được cấp quyền ghi
  const { error } = await db().from('comment_likes').insert({ comment_id: commentId })
  // Trùng khóa: đã thích rồi (bấm hai lần liên tiếp)
  if (error && !isUniqueViolation(error)) throw likeError(error) ?? error
}

/**
 * Xóa bình luận của chính mình, hoặc bất kỳ bình luận nào trong truyện mình là chủ (RLS quyết
 * định); không có quyền hay không có bình luận đó thì bỏ qua. Trả lời mất theo (khóa ngoại cascade).
 */
export async function deleteComment(id: string) {
  await requireUser()
  if (!isUuid(id)) return
  unwrap(await db().from('comments').delete().eq('id', id))
}

/** Mã lỗi của report_comment (mục 4 documents/thiet-ke-database.md); lỗi khác giữ nguyên */
function reportError(error: PostgrestError) {
  const code = businessCode(error)
  if (code === 'unauthenticated') return unauthenticated()
  if (code === 'not_found') return commentGone()
  if (code === 'own_comment') return ownCommentReport()
  return limitError(code)
}

/**
 * Báo cáo bình luận của người khác (cần đăng nhập). Đã có báo cáo đang mở cho bình luận này thì
 * RPC chỉ cập nhật lý do và ghi chú. Tối đa 10 báo cáo mới / giờ.
 */
export async function reportComment({ commentId, reason, note }: ReportCommentInput) {
  await requireUser()
  if (!isUuid(commentId)) throw commentGone()
  unwrap(
    await db().rpc('report_comment', {
      p_comment_id: commentId,
      p_reason: reason,
      p_note: note.trim(),
    }),
    reportError,
  )
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
