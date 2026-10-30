import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import * as api from './api'

export const notificationKeys = {
  all: (userId: string) => ['notifications', userId] as const,
  unread: (userId: string) => ['notifications', userId, 'unread'] as const,
  list: (userId: string, page: number, size: number) =>
    ['notifications', userId, 'list', page, size] as const,
}

/** Làm mới số chưa đọc mỗi phút và khi quay lại tab (không dùng realtime) */
const UNREAD_REFRESH_MS = 60_000

export function useUnreadNotificationCount() {
  const { data: user } = useSession()
  return useQuery({
    queryKey: notificationKeys.unread(user?.id ?? 'guest'),
    queryFn: api.getUnreadNotificationCount,
    enabled: !!user,
    refetchInterval: UNREAD_REFRESH_MS,
    refetchOnWindowFocus: true,
  })
}

export function useNotifications(page: number, size: number, enabled = true) {
  const { data: user } = useSession()
  return useQuery({
    queryKey: notificationKeys.list(user?.id ?? 'guest', page, size),
    queryFn: () => api.getNotifications(page, size),
    enabled: !!user && enabled,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  })
}

/** Mutation đổi thông báo: tải lại cả danh sách lẫn số chưa đọc */
function useNotificationMutation<T>(mutationFn: (variables: T) => Promise<void>) {
  const queryClient = useQueryClient()
  const userId = useSession().data?.id ?? 'guest'
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all(userId) }),
  })
}

export const useMarkNotificationsRead = () => useNotificationMutation(api.markNotificationsRead)
export const useMarkAllNotificationsRead = () =>
  useNotificationMutation<void>(() => api.markAllNotificationsRead())
export const useDeleteNotification = () => useNotificationMutation(api.deleteNotification)
