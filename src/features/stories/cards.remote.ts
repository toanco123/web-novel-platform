// Thẻ truyện lấy từ view story_cards, dùng chung cho các api.remote.ts (truyện, chương, tủ truyện,
// bình luận...). View đã áp RLS: người lạ chỉ thấy truyện công khai, chủ truyện thấy cả bản nháp.
import { unwrap } from '@/lib/dbError'
import { publicImageUrl } from '@/lib/imageUpload'
import { db } from '@/lib/supabase'
import { isUuid } from '@/lib/uuid'
import type { Database } from '@/types/database'
import type { Genre, Story } from '@/types/story'

export type StoryCardRow = Database['public']['Views']['story_cards']['Row']

/**
 * Cột cần cho thẻ truyện (danh sách): mô tả lấy bản rút gọn 300 ký tự, bỏ các cột thẻ không dùng.
 * Trang chi tiết (storyBySlug) lấy đủ cột. PostgREST vẫn lọc / sắp xếp được theo cột không chọn.
 */
export const CARD_COLUMNS =
  'id, slug, title, description:description_short, status, visibility, owner_id, author_name, author_key, cover_path, cover_thumb_path, genres, chapter_count, first_chapter_number, latest_chapter_number, latest_chapter_title, view_count, rating_count, rating_avg, created_at, updated_at, next_chapter_number, next_chapter_at' as const

/** Các cột toStory dùng: đủ cho cả dòng chọn CARD_COLUMNS lẫn dòng đầy đủ của view */
type StoryCardFields = Pick<
  StoryCardRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'description'
  | 'status'
  | 'visibility'
  | 'owner_id'
  | 'author_name'
  | 'author_key'
  | 'cover_path'
  | 'cover_thumb_path'
  | 'genres'
  | 'chapter_count'
  | 'first_chapter_number'
  | 'latest_chapter_number'
  | 'latest_chapter_title'
  | 'view_count'
  | 'rating_count'
  | 'rating_avg'
  | 'created_at'
  | 'updated_at'
  | 'next_chapter_number'
  | 'next_chapter_at'
>

/**
 * Khóa "tác giả" của truyện: chủ truyện, cộng bút danh nếu có (author_key của story_cards), giống
 * bản giả: tac-gia-<uuid> hoặc tac-gia-<uuid>-<bút-danh-dạng-slug>
 */
export const authorSlug = (ownerId: string, authorKey?: string | null) =>
  authorKey ? `tac-gia-${ownerId}-${authorKey}` : `tac-gia-${ownerId}`

/** Tách khóa tác giả; null nếu không đúng dạng (tránh gửi uuid hỏng lên máy chủ) */
export function parseAuthorSlug(slug: string) {
  const rest = slug.replace(/^tac-gia-/, '')
  const ownerId = rest.slice(0, 36)
  if (!isUuid(ownerId)) return null
  const key = rest.slice(37)
  return { ownerId, authorKey: key || null }
}

type GenreJson = { slug: string; name: string; description: string | null }

/** Cột của view đều có kiểu `| null` (Postgres không suy được NOT NULL qua view) */
export function toStory(row: StoryCardFields): Story {
  const genres = (row.genres as GenreJson[] | null) ?? []
  return {
    id: row.id!,
    slug: row.slug!,
    title: row.title!,
    author: { slug: authorSlug(row.owner_id!, row.author_key), name: row.author_name ?? '' },
    genres: genres.map((g): Genre =>
      g.description
        ? { slug: g.slug, name: g.name, description: g.description }
        : { slug: g.slug, name: g.name },
    ),
    status: row.status!,
    description: row.description ?? '',
    coverUrl: row.cover_path ? publicImageUrl('covers', row.cover_path) : null,
    coverThumbUrl: row.cover_thumb_path ? publicImageUrl('covers', row.cover_thumb_path) : null,
    chapterCount: row.chapter_count ?? 0,
    viewCount: row.view_count ?? 0,
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: row.rating_count ?? 0,
    firstChapterNumber: row.first_chapter_number,
    latestChapter:
      row.latest_chapter_number === null
        ? null
        : { number: row.latest_chapter_number, title: row.latest_chapter_title ?? '' },
    nextChapter:
      row.next_chapter_number === null || row.next_chapter_at === null
        ? null
        : { number: row.next_chapter_number, at: row.next_chapter_at },
    ownerId: row.owner_id,
    visibility: row.visibility!,
    createdAt: row.created_at!,
    updatedAt: row.updated_at!,
  }
}

/** Danh sách công khai: truyện đã xuất bản có ít nhất 1 chương (chủ truyện còn thấy bản nháp của mình) */
export function publicStoryCards(options?: { count?: 'exact' }) {
  return db()
    .from('story_cards')
    .select(CARD_COLUMNS, options)
    .eq('visibility', 'published')
    .gt('chapter_count', 0)
}

/** Truyện theo slug; người xem là chủ truyện thì thấy cả bản nháp (xem trước) */
export async function storyBySlug(slug: string): Promise<Story | null> {
  const row = unwrap(await db().from('story_cards').select('*').eq('slug', slug).maybeSingle())
  return row ? toStory(row) : null
}

/** Id truyện theo slug (theo quyền xem của người đang dùng); null nếu không có */
export async function storyIdBySlug(slug: string): Promise<string | null> {
  const row = unwrap(await db().from('stories').select('id').eq('slug', slug).maybeSingle())
  return row?.id ?? null
}

/** Nhiều truyện theo id, giữ đúng thứ tự `ids`; truyện không còn thấy được thì bỏ qua */
export async function storiesByIds(ids: string[]): Promise<Story[]> {
  if (!ids.length) return []
  const rows = unwrap(
    await db()
      .from('story_cards')
      .select(CARD_COLUMNS)
      .in('id', [...new Set(ids)]),
  )
  const byId = new Map(rows.map((r) => [r.id, toStory(r)]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

/** Nhiều truyện theo slug, giữ đúng thứ tự `slugs` */
export async function storiesBySlugs(slugs: string[]): Promise<Story[]> {
  if (!slugs.length) return []
  const rows = unwrap(
    await db()
      .from('story_cards')
      .select(CARD_COLUMNS)
      .in('slug', [...new Set(slugs)]),
  )
  const bySlug = new Map(rows.map((r) => [r.slug, toStory(r)]))
  return slugs.flatMap((slug) => bySlug.get(slug) ?? [])
}
