import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
