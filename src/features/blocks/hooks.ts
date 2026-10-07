import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import * as api from './api'

export const blockKeys = {
  list: (userId: string) => ['blocks', userId] as const,
}

export function useBlockedUsers() {
  const { data: user } = useSession()
  return useQuery({
    queryKey: blockKeys.list(user?.id ?? 'guest'),
    queryFn: api.getBlockedUsers,
    enabled: !!user,
  })
}

/** Chặn / bỏ chặn: tải lại bình luận (RLS ẩn hoặc hiện lại bình luận của người đó) và danh sách chặn */
function useBlockMutation(mutationFn: (userId: string) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all(
        [['comments'], ['blocks']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  })
}

export const useBlockUser = () => useBlockMutation(api.blockUser)
export const useUnblockUser = () => useBlockMutation(api.unblockUser)
