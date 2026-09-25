export const COVER_MAX_BYTES = 2 * 1024 * 1024
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const COVER_WIDTH = 480
const COVER_HEIGHT = 720 // tỉ lệ 2:3
const AVATAR_SIZE = 128

export class CoverError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoverError'
  }
}

export function validateCoverFile(file: File) {
  if (!COVER_TYPES.includes(file.type)) throw new CoverError('Chỉ nhận ảnh JPG, PNG hoặc WebP.')
  if (file.size > COVER_MAX_BYTES) throw new CoverError('Ảnh tối đa 2 MB. Chọn ảnh nhỏ hơn nhé.')
}

/**
 * Cắt giữa ảnh theo tỉ lệ khung đích, thu về đúng kích thước rồi xuất WebP
 * (trình duyệt không hỗ trợ thì JPEG). Trả về data URL; khi nối Supabase sẽ upload blob lên Storage.
 */
async function prepareImage(file: File, width: number, height: number): Promise<string> {
  validateCoverFile(file)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new CoverError('Không đọc được ảnh này. Thử một ảnh khác nhé.')
  }

  const target = width / height
  let sw = bitmap.width
  let sh = bitmap.height
  if (sw / sh > target) sw = sh * target
  else sh = sw / target
  const sx = (bitmap.width - sw) / 2
  const sy = (bitmap.height - sh) / 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new CoverError('Trình duyệt không hỗ trợ xử lý ảnh.')
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)
  bitmap.close()

  const webp = canvas.toDataURL('image/webp', 0.85)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
}

/** Ảnh bìa truyện: cắt giữa theo khung 2:3, 480×720 */
export const prepareCover = (file: File) => prepareImage(file, COVER_WIDTH, COVER_HEIGHT)

/** Ảnh đại diện: cắt giữa thành hình vuông 128×128 (nhỏ để lưu tạm trong localStorage) */
export const prepareAvatar = (file: File) => prepareImage(file, AVATAR_SIZE, AVATAR_SIZE)
