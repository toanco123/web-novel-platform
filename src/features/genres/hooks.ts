import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'

export const genreKeys = {
  all: ['genres'] as const,
}

export const useGenres = () => useQuery({ queryKey: genreKeys.all, queryFn: api.getGenres })

export function useCreateGenre() {
  const queryClient = useQueryClient()
  // Trả về promise để callback riêng của mutate (chọn thể loại, hiện link) chạy sau khi tải lại xong
  const refresh = () => queryClient.invalidateQueries({ queryKey: genreKeys.all })
  return useMutation({
    mutationFn: api.createGenre,
    onSuccess: refresh,
    // Trùng thể loại mà danh sách đang có chưa thấy (người khác vừa tạo): tải lại để chip, trang
    // thể loại và bản xem trước truyện tìm được nó
    onError: (error) => (error instanceof api.GenreExistsError ? refresh() : undefined),
  })
}
