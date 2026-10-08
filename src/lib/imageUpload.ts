// Ảnh bìa và ảnh đại diện trên Supabase Storage (chỉ dùng trong các api.remote.ts).
// prepareCover/prepareAvatar (src/lib/image.ts) trả data URL; ở đây đổi sang file và upload vào
// {user_id}/{uuid}.webp. Tên file ngẫu nhiên nên đổi ảnh không bị cache ảnh cũ.
import { ImageLimitError } from './image'
import { db } from './supabase'

export type ImageBucket = 'covers' | 'avatars'

export const isDataUrl = (value: string | null | undefined): value is string =>
  !!value && value.startsWith('data:')

export const publicImageUrl = (bucket: ImageBucket, path: string) =>
  db().storage.from(bucket).getPublicUrl(path).data.publicUrl

/** Đường dẫn trong bucket từ public URL của chính bucket đó; null nếu là URL ngoài (vd ảnh Google) */
export function imagePathFromUrl(bucket: ImageBucket, url: string | null | undefined) {
  if (!url) return null
  const prefix = publicImageUrl(bucket, '')
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null
}

/** Upload ảnh (data URL) vào thư mục của người dùng, trả về đường dẫn trong bucket */
export const uploadImage = (bucket: ImageBucket, userId: string, dataUrl: string) =>
  upload(bucket, `${userId}/${crypto.randomUUID()}`, dataUrl)

/**
 * Bản nhỏ cạnh ảnh gốc: {uuid}.webp → {uuid}-thumb.webp (đuôi theo định dạng của bản nhỏ). Hạn mức
 * ảnh không tính bản nhỏ của ảnh gốc đã có (private.image_upload_allowed)
 */
export const uploadThumb = (bucket: ImageBucket, originalPath: string, dataUrl: string) =>
  upload(bucket, `${originalPath.replace(/\.[a-z]+$/, '')}-thumb`, dataUrl)

/** Upload vào `base` + đuôi theo định dạng ảnh (.jpg hoặc .webp) */
async function upload(bucket: ImageBucket, base: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob()
  const ext = blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const path = `${base}.${ext}`
  const { error } = await db()
    .storage.from(bucket)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  // Luôn ghi vào thư mục của chính mình nên bị RLS chặn nghĩa là vượt hạn mức ảnh
  if (error) throw /row-level security/i.test(error.message) ? new ImageLimitError() : error
  return path
}

/** Xóa mọi ảnh trong thư mục của người dùng (khi xóa tài khoản) */
export async function removeUserImages(bucket: ImageBucket, userId: string) {
  const { data, error } = await db().storage.from(bucket).list(userId, { limit: 1000 })
  if (error) throw error
  const paths = data.map((file) => `${userId}/${file.name}`)
  if (paths.length) {
    const { error: removeError } = await db().storage.from(bucket).remove(paths)
    if (removeError) throw removeError
  }
}

/** Xóa ảnh cũ (ảnh gốc và bản nhỏ); lỗi thì bỏ qua (chỉ để lại file thừa, không ảnh hưởng dữ liệu) */
export async function removeImage(bucket: ImageBucket, ...paths: (string | null | undefined)[]) {
  const existing = paths.filter((p): p is string => !!p)
  if (!existing.length) return
  await db().storage.from(bucket).remove(existing)
}
