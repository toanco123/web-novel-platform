// Phần dùng chung của hai backend thể loại (api.mock.ts, api.remote.ts)
import { slugify } from '@/lib/slugify'
import type { Genre } from '@/types/story'

export type GenreWithCount = Genre & {
  storyCount: number
  /** null: thể loại có sẵn */
  createdAt: string | null
}

export class GenreExistsError extends Error {
  genre: Genre
  constructor(genre: Genre) {
    super(`Thể loại "${genre.name}" đã có.`)
    this.name = 'GenreExistsError'
    this.genre = genre
  }
}

/**
 * Tên người dùng gõ → tên lưu (bỏ khoảng trắng thừa, viết hoa chữ cái đầu) và slug để chặn trùng:
 * "  ngôn   tình " → { name: 'Ngôn tình', slug: 'ngon-tinh' }
 */
export function normalizeGenreName(input: string) {
  const name = input.trim().replace(/\s+/g, ' ')
  return { name: name.charAt(0).toLocaleUpperCase('vi') + name.slice(1), slug: slugify(name) }
}
