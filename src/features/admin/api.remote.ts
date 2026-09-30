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
  ADMIN_PAGE_SIZE,
  AdminError,
  isAdminErrorCode,
  type AdminComment,
  type AdminCommentQuery,
  type AdminContactMessage,
  type AdminMessageQuery,
  type AdminOverview,
  type AdminReport,
  type AdminReportQuery,
  type AdminStory,
  type AdminStoryQuery,
  type AdminUser,
  type AdminUserQuery,
  type CuratedStory,
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

export async function getAdminOverview(days: number): Promise<AdminOverview> {
  await requireUserId()
  const data = unwrap(await db().rpc('admin_overview', { p_days: days }), adminError)
  return data as unknown as AdminOverview
}

export async function getAdminUsers({ q, page }: AdminUserQuery): Promise<Page<AdminUser>> {
  await requireUserId()
  const result = await loadPage(page, ADMIN_PAGE_SIZE, (from, to) =>
    db()
      .rpc('admin_users', { p_query: q || undefined }, { count: 'exact' })
      .range(from, to),
  ).catch(rethrow)
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

export async function getAdminStories({
  q,
  visibility,
  ownerId,
  sort,
  page,
}: AdminStoryQuery): Promise<Page<AdminStory>> {
  await requireUserId()
  // Id tác giả sai định dạng (link sửa tay) thì coi như không có truyện nào
  if (ownerId && !isUuid(ownerId)) return { items: [], total: 0, page: 1, pageCount: 1 }
  const result = await loadPage(page, ADMIN_PAGE_SIZE, (from, to) =>
    db()
      .rpc(
        'admin_stories',
        { p_query: q || undefined, p_visibility: visibility, p_owner_id: ownerId, p_sort: sort },
        { count: 'exact' },
      )
      .range(from, to),
  ).catch(rethrow)
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
    })),
  }
}

// ── Hộp thư & báo lỗi ───────────────────────────────────────────────────

export async function getAdminMessages({
  status,
  page,
}: AdminMessageQuery): Promise<Page<AdminContactMessage>> {
  await requireUserId()
  const result = await loadPage(page, ADMIN_PAGE_SIZE, (from, to) =>
    db()
      .rpc(
        'admin_contact_messages',
        { p_status: status === 'all' ? undefined : status },
        { count: 'exact' },
      )
      .range(from, to),
  ).catch(rethrow)
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
  page,
}: AdminReportQuery): Promise<Page<AdminReport>> {
  await requireUserId()
  const result = await loadPage(page, ADMIN_PAGE_SIZE, (from, to) =>
    db()
      .rpc('admin_reports', { p_status: status === 'all' ? undefined : status }, { count: 'exact' })
      .range(from, to),
  ).catch(rethrow)
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
  page,
}: AdminCommentQuery): Promise<Page<AdminComment>> {
  await requireUserId()
  const result = await loadPage(page, ADMIN_PAGE_SIZE, (from, to) =>
    db()
      .rpc(
        'admin_comments',
        { p_query: q || undefined, p_reported: view === 'reported' },
        { count: 'exact' },
      )
      .range(from, to),
  ).catch(rethrow)
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
