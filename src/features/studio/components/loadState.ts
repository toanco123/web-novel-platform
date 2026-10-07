import { StudioError } from '../api'

/** Lỗi "không tìm thấy" thật (truyện không có hoặc không phải của mình), khác lỗi mạng */
export const isNotFoundError = (error: unknown) =>
  error instanceof StudioError && error.code === 'not_found'

/** Query chưa có dữ liệu nào vì lỗi (lỗi khi làm mới ở nền thì vẫn giữ dữ liệu cũ, không tính) */
export const loadFailed = (query: { isError: boolean; data: unknown }) =>
  query.isError && query.data === undefined
