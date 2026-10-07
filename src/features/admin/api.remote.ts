// Trang quản trị trên Supabase: RPC admin_overview, admin_users, admin_stories (migration
// admin_dashboard). Người không phải quản trị viên nhận lỗi 'forbidden' → AdminError.
import type { PostgrestError } from '@supabase/supabase-js'
import { requireUserId } from '@/features/auth/api'
import { businessCode, unwrap } from '@/lib/dbError'
import { loadPage } from '@/lib/dbPage'
import { db } from '@/lib/supabase'
import { isUuid } from '@/lib/uuid'
import { normalizeGenreName } from '@/features/genres/api'
import type { Page } from '@/types/page'
import type { CuratedList, Genre } from '@/types/story'
import {
  AdminError,
  adminPageSize,
  isAdminErrorCode,
  type AdminComment,
  type AdminCommentQuery,
  type AdminContactMessage,
  type AdminMessageQuery,
  type AdminOverview,
  type AdminTtsUsage,
  type AdminReport,
  type AdminReportQuery,
  type AdminStory,
  type AdminStoryQuery,
  type AdminUser,
  type AdminUserQuery,
  type CuratedStory,
  type ReviewInput,
  type SortOrder,
} from './shared'

/** Mã lỗi của các RPC admin (forbidden, not_found, cannot_ban_*) → AdminError; lỗi khác null */
function adminError(error: PostgrestError) {
  const code = businessCode(error)
  return code && isAdminErrorCode(code) ? new AdminError(code) : null
}

/** Dùng trong .catch() của loadPage: lỗi quyền → AdminError, lỗi khác ném nguyên */
const rethrow = (error: PostgrestError) => {
  throw adminError(error) ?? error
}

// Lọc, sắp xếp và phân trang làm bằng PostgREST ngay trên kết quả của RPC trả bảng (hàm trả về cả
// danh sách, PostgREST bọc thêm where / order by / limit). Không kèm order thì giảm dần.

/** Tùy chọn của .order(): giá trị trống luôn xếp cuối, dù tăng hay giảm */
const direction = (order: SortOrder = 'desc') => ({
  ascending: order === 'asc',
  nullsFirst: false,
})

export async function getAdminOverview(days: number): Promise<AdminOverview> {
  await requireUserId()
  const data = unwrap(await db().rpc('admin_overview', { p_days: days }), adminError)
  return data as unknown as AdminOverview
}

export async function getAdminTtsUsage(): Promise<AdminTtsUsage> {
  await requireUserId()
  const data = unwrap(await db().rpc('admin_tts_usage'), adminError)
  return data as unknown as AdminTtsUsage
}

const userSortColumns = {
  name: 'display_name',
  created: 'created_at',
  lastSignIn: 'last_sign_in_at',
  stories: 'story_count',
  comments: 'comment_count',
  follows: 'follow_count',
} as const

export async function getAdminUsers({
  q,
  role,
  status,
  provider,
  sort = 'created',
  order,
  page,
  pageSize,
}: AdminUserQuery): Promise<Page<AdminUser>> {
  await requireUserId()
  const result = await loadPage(page, adminPageSize(pageSize), (from, to) => {
    let query = db().rpc('admin_users', { p_query: q || undefined }, { count: 'exact' })
    if (role) query = query.eq('is_admin', role === 'admin')
    if (status) query = query.eq('is_banned', status === 'banned')
    if (provider) query = query.eq('provider', provider)
    return query.order(userSortColumns[sort], direction(order)).order('id').range(from, to)
  }).catch(rethrow)
  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_url ?? null,
      provider: r.provider,
      isAdmin: r.is_admin,
      createdAt: r.created_at ?? null,
      lastSignInAt: r.last_sign_in_at ?? null,
      storyCount: r.story_count,
      commentCount: r.comment_count,
      followCount: r.follow_count,
      isBanned: r.is_banned,
    })),
  }
}

const storySortColumns = {
  title: 'title',
  chapters: 'published_count',
  views: 'view_count',
  followers: 'follower_count',
  rating: 'rating_avg',
  comments: 'comment_count',
  reports: 'open_reports',
  created: 'created_at',
  updated: 'updated_at',
  submitted: 'review_submitted_at',
} as const

export async function getAdminStories({
  q,
  visibility,
  status,
  hasReports,
  review,
  ownerId,
  sort = 'updated',
  order,
  page,
  pageSize,
}: AdminStoryQuery): Promise<Page<AdminStory>> {
  await requireUserId()
  // Id tác giả sai định dạng (link sửa tay) thì coi như không có truyện nào
  if (ownerId && !isUuid(ownerId)) return { items: [], total: 0, page: 1, pageCount: 1 }
  const result = await loadPage(page, adminPageSize(pageSize), (from, to) => {
    let query = db().rpc(
      'admin_stories',
      {
        p_query: q || undefined,
        // Truyện bị gỡ cũng là nháp; lọc riêng bằng taken_down_at ở dưới
        p_visibility: visibility === 'takedown' ? 'draft' : visibility,
        p_owner_id: ownerId,
      },
      { count: 'exact' },
    )
    if (visibility === 'takedown') query = query.not('taken_down_at', 'is', null)
    if (status) query = query.eq('status', status)
    if (hasReports) query = query.gt('open_reports', 0)
    if (review) query = query.eq('review_status', review)
    return query
      .order(storySortColumns[sort], direction(order))
      .order('updated_at', { ascending: false })
      .order('id')
      .range(from, to)
  }).catch(rethrow)
  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      ownerId: r.owner_id,
      ownerName: r.owner_name,
      visibility: r.visibility,
      status: r.status,
      publishedCount: r.published_count,
      chapterCount: r.chapter_count,
      views: r.view_count,
      followers: r.follower_count,
      ratingAvg: Number(r.rating_avg),
      ratingCount: r.rating_count,
      comments: r.comment_count,
      openReports: r.open_reports,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      takedown:
        r.taken_down_at && r.takedown_reason
          ? { at: r.taken_down_at, reason: r.takedown_reason }
          : null,
      // Kiểu sinh ra của hàm trả bảng không có null, nhưng cột duyệt và bút danh có thể trống
      review: r.review_status
        ? {
            status: r.review_status,
            submittedAt: r.review_submitted_at ?? null,
            reviewedAt: r.reviewed_at ?? null,
            reason: r.review_reason ?? null,
          }
        : null,
      authorName: r.author_name ?? null,
      genreSlugs: r.genre_slugs ?? [],
    })),
  }
}

// ── Hộp thư & báo lỗi ───────────────────────────────────────────────────

export async function getAdminMessages({
  status,
  topic,
  q,
  order,
  page,
  pageSize,
}: AdminMessageQuery): Promise<Page<AdminContactMessage>> {
  await requireUserId()
  const result = await loadPage(page, adminPageSize(pageSize), (from, to) => {
    let query = db().rpc(
      'admin_contact_messages',
      { p_status: status === 'all' ? undefined : status, p_query: q || undefined },
      { count: 'exact' },
    )
    if (topic) query = query.eq('topic', topic)
    return query.order('created_at', direction(order)).order('id').range(from, to)
  }).catch(rethrow)
  return {
    ...result,
    items: result.items.map((r) => ({
      id: String(r.id),
      name: r.name,
      email: r.email,
      topic: r.topic,
      message: r.message,
      createdAt: r.created_at,
      handledAt: r.handled_at ?? null,
    })),
  }
}

export async function setMessageHandled(id: string, handled: boolean) {
  await requireUserId()
  unwrap(
    await db().rpc('admin_set_contact_handled', { p_id: Number(id), p_handled: handled }),
    adminError,
  )
}

export async function getAdminReports({
  status,
  reason,
  q,
  order,
  page,
  pageSize,
}: AdminReportQuery): Promise<Page<AdminReport>> {
  await requireUserId()
  const result = await loadPage(page, adminPageSize(pageSize), (from, to) => {
    let query = db().rpc(
      'admin_reports',
      { p_status: status === 'all' ? undefined : status, p_query: q || undefined },
      { count: 'exact' },
    )
    if (reason) query = query.eq('reason', reason)
    return query.order('created_at', direction(order)).order('id').range(from, to)
  }).catch(rethrow)
  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      storySlug: r.story_slug,
      storyTitle: r.story_title,
      storyPublished: r.story_visibility === 'published',
      chapterNumber: r.chapter_number,
      chapterTitle: r.chapter_title,
      reason: r.reason,
      note: r.note,
      status: r.status,
      reporter: { id: r.reporter_id, displayName: r.reporter_name },
      createdAt: r.created_at,
    })),
  }
}

export async function setAdminReportStatus(id: string, status: AdminReport['status']) {
  await requireUserId()
  if (!isUuid(id)) throw new Error('Id báo lỗi không hợp lệ')
  unwrap(await db().rpc('admin_set_report_status', { p_id: id, p_status: status }), adminError)
}

// ── Bình luận ───────────────────────────────────────────────────────────

export async function getAdminComments({
  view,
  q,
  kind,
  sort = view === 'reported' ? 'reported' : 'created',
  order,
  page,
  pageSize,
}: AdminCommentQuery): Promise<Page<AdminComment>> {
  await requireUserId()
  const result = await loadPage(page, adminPageSize(pageSize), (from, to) => {
    let query = db().rpc(
      'admin_comments',
      { p_query: q || undefined, p_reported: view === 'reported' },
      { count: 'exact' },
    )
    if (kind) query = query.eq('is_reply', kind === 'reply')
    return query
      .order(sort === 'reported' ? 'last_reported_at' : 'created_at', direction(order))
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
  }).catch(rethrow)
  return {
    ...result,
    items: result.items.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      isReply: r.is_reply,
      replyCount: r.reply_count,
      author: { id: r.user_id, displayName: r.user_name },
      storySlug: r.story_slug,
      storyTitle: r.story_title,
      storyPublished: r.story_visibility === 'published',
      chapterNumber: r.chapter_number ?? null,
      // RPC dựng sẵn mảng đúng dạng AdminComment['reports']
      reports: r.reports as unknown as AdminComment['reports'],
    })),
  }
}

/** Xóa bình luận của bất kỳ ai, kèm trả lời và báo cáo của nó */
export async function deleteAdminComment(id: string) {
  await requireUserId()
  if (!isUuid(id)) throw new AdminError('not_found')
  unwrap(await db().rpc('admin_delete_comment', { p_id: id }), adminError)
}

/** Đóng mọi báo cáo đang mở của một bình luận, bình luận giữ nguyên */
export async function dismissCommentReports(commentId: string) {
  await requireUserId()
  if (!isUuid(commentId)) throw new AdminError('not_found')
  unwrap(await db().rpc('admin_dismiss_comment_reports', { p_comment_id: commentId }), adminError)
}

// ── Khóa tài khoản, gỡ truyện ───────────────────────────────────────────

export async function setUserBanned(userId: string, banned: boolean) {
  await requireUserId()
  if (!isUuid(userId)) throw new AdminError('not_found')
  unwrap(
    await db().rpc('admin_set_user_banned', { p_user_id: userId, p_banned: banned }),
    adminError,
  )
}

/** reason null/rỗng: khôi phục (truyện vẫn là nháp, tác giả tự xuất bản lại) */
export async function setStoryTakedown(storyId: string, reason: string | null) {
  await requireUserId()
  if (!isUuid(storyId)) throw new AdminError('not_found')
  unwrap(
    await db().rpc('admin_set_story_takedown', {
      p_story_id: storyId,
      // Kiểu sinh ra đòi string; RPC coi chuỗi rỗng là khôi phục
      p_reason: reason?.trim() ?? '',
    }),
    adminError,
  )
}

/** Duyệt (công khai luôn) hoặc từ chối (kèm lý do) truyện đang chờ duyệt */
export async function reviewStory({ storyId, approve, reason }: ReviewInput) {
  await requireUserId()
  if (!isUuid(storyId)) throw new AdminError('not_found')
  unwrap(
    await db().rpc('admin_review_story', {
      p_story_id: storyId,
      p_approve: approve,
      // Kiểu sinh ra đòi string; RPC coi chuỗi rỗng là không có lý do
      p_reason: reason?.trim() ?? '',
    }),
    adminError,
  )
}

// ── Thể loại ────────────────────────────────────────────────────────────

export async function updateGenre(
  slug: string,
  input: { name: string; description: string },
): Promise<Genre> {
  await requireUserId()
  const { name } = normalizeGenreName(input.name)
  const row = unwrap(
    await db().rpc('admin_update_genre', {
      p_slug: slug,
      p_name: name,
      p_description: input.description.trim(),
    }),
    adminError,
  ) as { slug: string; name: string; description: string | null }
  return { slug: row.slug, name: row.name, description: row.description ?? undefined }
}

export async function deleteGenre(slug: string) {
  await requireUserId()
  unwrap(await db().rpc('admin_delete_genre', { p_slug: slug }), adminError)
}

/** Gộp `from` vào `into`; trả về số truyện được chuyển sang */
export async function mergeGenres(from: string, into: string): Promise<number> {
  await requireUserId()
  return unwrap(await db().rpc('admin_merge_genres', { p_from: from, p_into: into }), adminError)
}

// ── Truyện chọn tay trên trang chủ ──────────────────────────────────────

/** Danh sách đã chọn theo thứ tự, kể cả truyện đang ẩn (để admin thấy và bỏ đi) */
export async function getCuratedStories(list: CuratedList): Promise<CuratedStory[]> {
  await requireUserId()
  const rows = unwrap(await db().rpc('admin_curated', { p_list: list }), adminError)
  return rows.map((r) => ({
    id: r.story_id,
    slug: r.slug,
    title: r.title,
    authorName: r.author_name,
    isPublic: r.is_public,
  }))
}

/** Thay cả danh sách theo thứ tự đưa vào (id lặp lại chỉ giữ lần đầu); rỗng: trang chủ tự chọn */
export async function setCuratedStories(list: CuratedList, storyIds: string[]) {
  await requireUserId()
  if (!storyIds.every(isUuid)) throw new AdminError('not_found')
  unwrap(await db().rpc('admin_set_curated', { p_list: list, p_story_ids: storyIds }), adminError)
}
