// Nơi DUY NHẤT xử lý thể loại. Giai đoạn UI: thể loại có sẵn + do người dùng tạo (localStorage).
import { requireUser } from '@/features/auth/api'
import { mockDelay as delay } from '@/lib/mockStorage'
import { slugify } from '@/lib/slugify'
import { allGenres, catalog } from '@/mocks/catalog'
import { loadUserGenres, saveUserGenres } from '@/mocks/userContent'
import type { Genre } from '@/types/story'

export type GenreWithCount = Genre & { storyCount: number }

export class GenreExistsError extends Error {
  genre: Genre
  constructor(genre: Genre) {
    super(`Thể loại "${genre.name}" đã có.`)
    this.name = 'GenreExistsError'
    this.genre = genre
  }
}

export async function getGenres(): Promise<GenreWithCount[]> {
  await delay(100)
  const stories = catalog().filter((s) => s.chapterCount > 0)
  return allGenres().map((g) => ({
    ...g,
    storyCount: stories.filter((s) => s.genres.some((sg) => sg.slug === g.slug)).length,
  }))
}

/** Chặn trùng theo slug: "Ngôn Tình", "ngôn tình", "ngon tinh" là một */
export async function createGenre(input: { name: string; description?: string }): Promise<Genre> {
  await delay(300)
  const user = await requireUser()
  const name = input.name.trim().replace(/\s+/g, ' ')
  const slug = slugify(name)
  const existing = allGenres().find((g) => g.slug === slug)
  if (existing) throw new GenreExistsError(existing)

  const genre = {
    slug,
    name: name.charAt(0).toLocaleUpperCase('vi') + name.slice(1),
    description: input.description?.trim() || undefined,
    createdBy: { id: user.id, displayName: user.displayName },
  }
  saveUserGenres([...loadUserGenres(), { ...genre, createdAt: new Date().toISOString() }])
  return genre
}
