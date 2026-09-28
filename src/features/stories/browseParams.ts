// Bộ lọc danh sách truyện ↔ query string (giữ trên URL để chia sẻ được)
import type { StoryStatus } from '@/types/story'
import type { BrowseFilters, StoryLength, StorySort } from './api'

export const statusOptions: { value: StoryStatus; param: string; label: string }[] = [
  { value: 'ongoing', param: 'ongoing', label: 'Đang ra' },
  { value: 'completed', param: 'completed', label: 'Hoàn thành' },
]

export const lengthOptions: { value: StoryLength; param: string; label: string }[] = [
  { value: 'short', param: 'short', label: 'Dưới 50 chương' },
  { value: 'medium', param: 'medium', label: '50–200 chương' },
  { value: 'long', param: 'long', label: 'Trên 200 chương' },
]

export const sortOptions: { value: StorySort; param: string; label: string }[] = [
  { value: 'updated', param: 'updated', label: 'Mới cập nhật' },
  { value: 'views', param: 'views', label: 'Đọc nhiều' },
  { value: 'rating', param: 'rating', label: 'Đánh giá cao' },
  { value: 'newest', param: 'newest', label: 'Mới đăng' },
]

const fromParam = <T>(options: { value: T; param: string }[], param: string | null) =>
  options.find((o) => o.param === param)?.value

const toParam = <T>(options: { value: T; param: string }[], value: T | undefined) =>
  options.find((o) => o.value === value)?.param

export function parseBrowseParams(params: URLSearchParams): BrowseFilters {
  return {
    status: fromParam(statusOptions, params.get('status')),
    genre: params.get('genre') || undefined,
    length: fromParam(lengthOptions, params.get('length')),
    sort: fromParam(sortOptions, params.get('sort')) ?? 'updated',
    page: Math.max(1, Number(params.get('page')) || 1),
  }
}

/** Query string cho bộ lọc; bỏ giá trị mặc định (sắp xếp mới cập nhật, trang 1) cho URL gọn */
export function browseSearch(filters: BrowseFilters) {
  const params = new URLSearchParams()
  const set = (key: string, value: string | undefined) => value && params.set(key, value)
  set('status', toParam(statusOptions, filters.status))
  set('genre', filters.genre)
  set('length', toParam(lengthOptions, filters.length))
  if (filters.sort && filters.sort !== 'updated') set('sort', toParam(sortOptions, filters.sort))
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  const s = params.toString()
  return s ? `?${s}` : ''
}
