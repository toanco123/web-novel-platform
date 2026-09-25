import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import * as api from './api'

export const libraryKeys = {
  follow: (userId: string, slug: string) => ['library', userId, slug] as const,
}

/** null khi chưa đăng nhập */
export function useFollowStatus(slug: string) {
  const { data: user } = useSession()
  return useQuery({
    queryKey: libraryKeys.follow(user?.id ?? 'guest', slug),
    queryFn: () => api.getFollowStatus(slug),
    enabled: !!user,
  })
}

export function useToggleFollow(slug: string) {
  const { data: user } = useSession()
  const queryClient = useQueryClient()
  const key = libraryKeys.follow(user?.id ?? 'guest', slug)

  return useMutation({
    mutationFn: (follow: boolean) => (follow ? api.followStory(slug) : api.unfollowStory(slug)),
    // Đổi giao diện ngay, lỗi thì trả lại trạng thái cũ
    onMutate: async (follow) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<boolean>(key)
      queryClient.setQueryData(key, follow)
      return { previous }
    },
    onError: (_error, _follow, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
