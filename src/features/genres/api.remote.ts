// Thể loại trên Supabase: thêm vào bảng genres, đọc từ view genre_cards (kèm số truyện công khai).
// slug là khóa chính, do trigger đặt = slugify(name), nên tạo trùng tên là lỗi 23505.
import { limitError, requireUser } from '@/features/auth/api'
import { businessCode, isUniqueViolation, unwrap } from '@/lib/dbError'
import { db } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Genre } from '@/types/story'
import { GenreExistsError, type GenreWithCount, normalizeGenreName } from './shared'

type GenreCardRow = Database['public']['Views']['genre_cards']['Row']
type GenreInsert = Database['public']['Tables']['genres']['Insert']

/** Cột của view đều có kiểu `| null` (Postgres không suy được NOT NULL qua view) */
function toGenre(
  row: Pick<GenreCardRow, 'slug' | 'name' | 'description' | 'created_by' | 'created_by_name'>,
): Genre {
  return {
    slug: row.slug!,
    name: row.name!,
    ...(row.description ? { description: row.description } : {}),
    // null: thể loại có sẵn (quản trị thêm qua Dashboard)
    createdBy: row.created_by
      ? { id: row.created_by, displayName: row.created_by_name ?? '' }
      : null,
  }
}

async function genreBySlug(slug: string): Promise<Genre | null> {
  const row = unwrap(
    await db()
      .from('genre_cards')
      .select('slug, name, description, created_by, created_by_name')
      .eq('slug', slug)
      .maybeSingle(),
  )
  return row ? toGenre(row) : null
}

export async function getGenres(): Promise<GenreWithCount[]> {
  const rows = unwrap(
    await db()
      .from('genre_cards')
      .select('slug, name, description, created_by, created_by_name, story_count, created_at')
      .order('created_at')
      .order('name'),
  )
  // Như bản giả: thể loại có sẵn đứng trước (header, footer chỉ hiện vài thể loại đầu), rồi tới thể
  // loại người dùng tạo theo thứ tự tạo. sort giữ nguyên thứ tự trong mỗi nhóm.
  return rows
    .map((row) => ({
      ...toGenre(row),
      storyCount: row.story_count ?? 0,
      // Thể loại có sẵn (không có người tạo) không hiện ngày tạo, như bản giả
      createdAt: row.created_by ? row.created_at : null,
    }))
    .sort((a, b) => Number(!!a.createdBy) - Number(!!b.createdBy))
}

/** Chặn trùng theo slug: "Ngôn Tình", "ngôn tình", "ngon tinh" là một */
export async function createGenre(input: { name: string; description?: string }): Promise<Genre> {
  const user = await requireUser()
  const { name } = normalizeGenreName(input.name)
  const result = await db()
    .from('genres')
    // Chỉ được ghi name, description: slug do trigger đặt, created_by mặc định là người đang đăng
    // nhập. Kiểu sinh ra vẫn đòi slug vì cột không có default.
    .insert({ name, description: input.description?.trim() || null } as GenreInsert)
    .select('slug, name, description')
    .single()
  if (isUniqueViolation(result.error)) {
    // Đã có từ trước, hoặc vừa có người tạo trùng. Slug bị trùng do trigger tính bằng slugify của
    // DB, khác src/lib/slugify.ts ở vài chữ hiếm (Ð U+00D0 trông như Đ, æ, ø, ß...) nên hỏi DB.
    // Không tìm thấy thì ném nguyên lỗi (thông báo chung)
    const slug = unwrap(await db().rpc('slugify', { value: name }))
    const existing = await genreBySlug(slug)
    if (existing) throw new GenreExistsError(existing)
  }
  // Quá 10 thể loại / ngày thì DB báo rate_limited
  const row = unwrap(result, (error) => limitError(businessCode(error)))
  return {
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    createdBy: { id: user.id, displayName: user.displayName },
  }
}
