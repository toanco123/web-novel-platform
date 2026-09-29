// Trang quản trị trên Supabase: RPC admin_overview, admin_users, admin_stories (migration
// admin_dashboard). Người không phải quản trị viên nhận lỗi 'forbidden' → AdminError.
import type { PostgrestError } from '@supabase/supabase-js'
import { requireUserId } from '@/features/auth/api'
import { businessCode, unwrap } from '@/lib/dbError'
import { loadPage } from '@/lib/dbPage'
import { db } from '@/lib/supabase'
import { isUuid } from '@/lib/uuid'
import type { Page } from '@/types/page'
import {
  ADMIN_PAGE_SIZE,
  AdminError,
  type AdminContactMessage,
  type AdminMessageQuery,
  type AdminOverview,
  type AdminReport,
  type AdminReportQuery,
  type AdminStory,
  type AdminStoryQuery,
  type AdminUser,
  type AdminUserQuery,
} from './shared'

const adminError = (error: PostgrestError) =>
  businessCode(error) === 'forbidden' ? new AdminError() : null

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
