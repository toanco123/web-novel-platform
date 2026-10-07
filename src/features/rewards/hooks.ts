import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import * as api from './api'

export const rewardKeys = {
  all: (userId: string) => ['rewards', userId] as const,
  status: (userId: string) => ['rewards', userId, 'status'] as const,
  history: (userId: string, page: number) => ['rewards', userId, 'history', page] as const,
  votes: (slug: string, userId: string) => ['votes', slug, userId] as const,
}

/** Số phiếu và trạng thái điểm danh hôm nay của người đang đăng nhập */
export function useRewardStatus() {
  const { data: user } = useSession()
  return useQuery({
    queryKey: rewardKeys.status(user?.id ?? 'guest'),
    queryFn: api.getRewardStatus,
    enabled: !!user,
  })
}

export function useCheckIn() {
  const queryClient = useQueryClient()
  const userId = useSession().data?.id ?? 'guest'
  return useMutation({
    mutationFn: api.checkIn,
    onSuccess: (result) => {
      queryClient.setQueryData<api.RewardStatus>(
        rewardKeys.status(userId),
        (old) =>
          old && {
            ...old,
            balance: result.balance,
            checkedInToday: true,
            streak: result.streak,
            nextReward: api.rewardFor(result.streak + 1),
          },
      )
      void queryClient.invalidateQueries({ queryKey: [...rewardKeys.all(userId), 'history'] })
    },
    // Đã điểm danh ở tab hay máy khác: tải lại trạng thái cho đúng
    onError: () => queryClient.invalidateQueries({ queryKey: rewardKeys.status(userId) }),
  })
}

export function useTicketHistory(page: number) {
  const { data: user } = useSession()
  return useQuery({
    queryKey: rewardKeys.history(user?.id ?? 'guest', page),
    queryFn: () => api.getTicketHistory({ page }),
    enabled: !!user,
    placeholderData: keepPreviousData,
  })
}

/** Tổng đề cử của truyện (khách cũng xem được) và phiếu mình đã đề cử */
export function useStoryVoteSummary(slug: string) {
  const { data: user, isPending } = useSession()
  return useQuery({
    queryKey: rewardKeys.votes(slug, user?.id ?? 'guest'),
    queryFn: () => api.getStoryVoteSummary(slug),
    enabled: !isPending,
  })
}

/** Đề cử xong: tải lại số phiếu, lịch sử, tổng đề cử của truyện và các bảng xếp hạng */
export function useVoteStory(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (amount: number) => api.voteStory(slug, amount),
    onSettled: () =>
      Promise.all(
        [['rewards'], ['votes', slug], ['stories', 'ranking']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
