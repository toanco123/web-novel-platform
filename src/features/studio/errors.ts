import { AuthError } from '@/features/auth/api'
import { GenreExistsError } from '@/features/genres/api'
import { StorageFullError } from '@/lib/mockStorage'
import { CoverError } from '@/lib/image'
import { StudioError } from './api'

/** Thông báo lỗi hiển thị cho người dùng từ lỗi bất kỳ trong khu Sáng tác */
export function studioErrorMessage(error: unknown) {
  if (
    error instanceof StudioError ||
    error instanceof AuthError ||
    error instanceof StorageFullError ||
    error instanceof CoverError ||
    error instanceof GenreExistsError
  ) {
    return error.message
  }
  return 'Có lỗi xảy ra, chưa lưu được. Thử lại sau ít phút.'
}
