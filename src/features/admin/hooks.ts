import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import * as api from './api'

export const adminKeys = {
  all: (userId: string) => ['admin', userId] as const,
  overview: (userId: string, days: number) => ['admin', userId, 'overview', days] as const,
  users: (userId: string, query: api.AdminUserQuery) => ['admin', userId, 'users', query] as const,
  stories: (userId: string, query: api.AdminStoryQuery) =>
    ['admin', userId, 'stories', query] as const,
}

function useUserId() {
  return useSession().data?.id ?? 'guest'
}

export function useAdminOverview(days: number) {
  const userId = useUserId()
  return useQuery({
    queryKey: adminKeys.overview(userId, days),
    queryFn: () => api.getAdminOverview(days),
    placeholderData: keepPreviousData,
  })
}

export function useAdminUsers(query: api.AdminUserQuery) {
  const userId = useUserId()
  return useQuery({
    queryKey: adminKeys.users(userId, query),
    queryFn: () => api.getAdminUsers(query),
    placeholderData: keepPreviousData,
  })
}

export function useAdminStories(query: api.AdminStoryQuery) {
  const userId = useUserId()
  return useQuery({
    queryKey: adminKeys.stories(userId, query),
    queryFn: () => api.getAdminStories(query),
    placeholderData: keepPreviousData,
  })
}

export function useAdminMessages(query: api.AdminMessageQuery) {
  const userId = useUserId()
  return useQuery({
    queryKey: [...adminKeys.all(userId), 'messages', query],
    queryFn: () => api.getAdminMessages(query),
    placeholderData: keepPreviousData,
  })
}

export function useAdminReports(query: api.AdminReportQuery) {
  const userId = useUserId()
  return useQuery({
    queryKey: [...adminKeys.all(userId), 'reports', query],
    queryFn: () => api.getAdminReports(query),
    placeholderData: keepPreviousData,
  })
}

/** Thao tác của admin: xong thì làm mới mọi dữ liệu admin (danh sách, ô số ở Tổng quan) */
function useAdminMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all(userId) }),
  })
}

export const useSetMessageHandled = () =>
  useAdminMutation(({ id, handled }: { id: string; handled: boolean }) =>
    api.setMessageHandled(id, handled),
  )

export const useSetUserBanned = () =>
  useAdminMutation(({ userId, banned }: { userId: string; banned: boolean }) =>
    api.setUserBanned(userId, banned),
  )

export const useSetStoryTakedown = () =>
  useAdminMutation(({ storyId, reason }: { storyId: string; reason: string | null }) =>
    api.setStoryTakedown(storyId, reason),
  )

export const useSetAdminReportStatus = () =>
  useAdminMutation(({ id, status }: { id: string; status: api.AdminReport['status'] }) =>
    api.setAdminReportStatus(id, status),
  )
