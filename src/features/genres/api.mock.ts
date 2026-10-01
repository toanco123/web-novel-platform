// Thể loại giả: thể loại có sẵn + do người dùng tạo (localStorage). Dùng cho test tự động và khi
// chạy không có Supabase (xem api.ts). Bản thật: api.remote.ts.
import { rateLimited, requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { allGenres, catalog } from '@/mocks/catalog'
import { countSince, DAY } from '@/mocks/rateLimit'
import { loadUserGenres, saveUserGenres } from '@/mocks/userContent'
import type { Genre } from '@/types/story'
import { GenreExistsError, type GenreWithCount, normalizeGenreName } from './shared'

export async function getGenres(): Promise<GenreWithCount[]> {
  await delay(100)
  const stories = catalog().filter((s) => s.chapterCount > 0)
  const created = new Map(loadUserGenres().map((g) => [g.slug, g.createdAt]))
  return allGenres().map((g) => ({
    ...g,
    storyCount: stories.filter((s) => s.genres.some((sg) => sg.slug === g.slug)).length,
    createdAt: created.get(g.slug) ?? null,
  }))
}

/** Chặn trùng theo slug: "Ngôn Tình", "ngôn tình", "ngon tinh" là một */
export async function createGenre(input: { name: string; description?: string }): Promise<Genre> {
  await delay(300)
  const user = await requireUser()
  const { name, slug } = normalizeGenreName(input.name)
  const existing = allGenres().find((g) => g.slug === slug)
  if (existing) throw new GenreExistsError(existing)
  const mine = loadUserGenres().filter((g) => g.createdBy?.id === user.id)
  if (
    countSince(
      mine.map((g) => g.createdAt),
      DAY,
    ) >= 10
  )
    throw rateLimited()

  const genre = {
    slug,
    name,
    description: input.description?.trim() || undefined,
    createdBy: { id: user.id, displayName: user.displayName },
  }
  saveUserGenres([...loadUserGenres(), { ...genre, createdAt: new Date().toISOString() }])
  return genre
}
