// Bộ lọc danh sách truyện ↔ query string tiếng Việt không dấu (giữ trên URL để chia sẻ được)
import type { StoryStatus } from '@/types/story'
import type { BrowseFilters, StoryLength, StorySort } from './api'

export const statusOptions: { value: StoryStatus; param: string; label: string }[] = [
  { value: 'ongoing', param: 'dang-ra', label: 'Đang ra' },
  { value: 'completed', param: 'hoan-thanh', label: 'Hoàn thành' },
]

export const lengthOptions: { value: StoryLength; param: string; label: string }[] = [
  { value: 'short', param: 'ngan', label: 'Dưới 50 chương' },
  { value: 'medium', param: 'vua', label: '50–200 chương' },
  { value: 'long', param: 'dai', label: 'Trên 200 chương' },
]

export const sortOptions: { value: StorySort; param: string; label: string }[] = [
  { value: 'updated', param: 'moi-cap-nhat', label: 'Mới cập nhật' },
  { value: 'views', param: 'doc-nhieu', label: 'Đọc nhiều' },
  { value: 'rating', param: 'danh-gia', label: 'Đánh giá cao' },
  { value: 'newest', param: 'moi-dang', label: 'Mới đăng' },
]

const fromParam = <T>(options: { value: T; param: string }[], param: string | null) =>
  options.find((o) => o.param === param)?.value

const toParam = <T>(options: { value: T; param: string }[], value: T | undefined) =>
  options.find((o) => o.value === value)?.param

export function parseBrowseParams(params: URLSearchParams): BrowseFilters {
  return {
    status: fromParam(statusOptions, params.get('trang-thai')),
    genre: params.get('the-loai') || undefined,
    length: fromParam(lengthOptions, params.get('do-dai')),
    sort: fromParam(sortOptions, params.get('sap-xep')) ?? 'updated',
    page: Math.max(1, Number(params.get('trang')) || 1),
  }
}

/** Query string cho bộ lọc; bỏ giá trị mặc định (sắp xếp mới cập nhật, trang 1) cho URL gọn */
export function browseSearch(filters: BrowseFilters) {
  const params = new URLSearchParams()
  const set = (key: string, value: string | undefined) => value && params.set(key, value)
  set('trang-thai', toParam(statusOptions, filters.status))
  set('the-loai', filters.genre)
  set('do-dai', toParam(lengthOptions, filters.length))
  if (filters.sort && filters.sort !== 'updated') set('sap-xep', toParam(sortOptions, filters.sort))
  if (filters.page && filters.page > 1) params.set('trang', String(filters.page))
  const s = params.toString()
  return s ? `?${s}` : ''
}
