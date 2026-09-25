import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from './api'

export const useSendContactMessage = () => useMutation({ mutationFn: api.sendContactMessage })

export function useReportChapter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.reportChapter,
    // Tác giả đang mở khu Sáng tác (tab khác) sẽ thấy báo lỗi mới khi quay lại
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studio'] }),
  })
}
