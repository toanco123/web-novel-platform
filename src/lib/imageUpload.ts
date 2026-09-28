// Ảnh bìa và ảnh đại diện trên Supabase Storage (chỉ dùng trong các api.remote.ts).
// prepareCover/prepareAvatar (src/lib/image.ts) trả data URL; ở đây đổi sang file và upload vào
// {user_id}/{uuid}.webp. Tên file ngẫu nhiên nên đổi ảnh không bị cache ảnh cũ.
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
export async function uploadImage(bucket: ImageBucket, userId: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob()
  const ext = blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await db()
    .storage.from(bucket)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

/** Xóa ảnh cũ; lỗi thì bỏ qua (chỉ để lại file thừa, không ảnh hưởng dữ liệu) */
export async function removeImage(bucket: ImageBucket, path: string | null | undefined) {
  if (!path) return
  await db().storage.from(bucket).remove([path])
}
