import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import type { ReadingProgress } from '@/types/library'
import * as api from './api'

/** Khách chưa đăng nhập dùng khóa 'guest' (lịch sử đọc vẫn lưu trên máy) */
export const libraryKeys = {
  all: (userId: string) => ['library', userId] as const,
  follow: (userId: string, slug: string) => ['library', userId, 'follow', slug] as const,
  list: (userId: string) => ['library', userId, 'list'] as const,
  updates: (userId: string) => ['library', userId, 'updates'] as const,
  history: (userId: string, limit?: number) => ['library', userId, 'history', limit] as const,
  progress: (userId: string, slug: string) => ['library', userId, 'progress', slug] as const,
}

function useLibraryUser() {
  const { data: user, isPending } = useSession()
  return { user, userId: user?.id ?? 'guest', sessionPending: isPending }
}

/** null khi chưa đăng nhập */
export function useFollowStatus(slug: string) {
  const { user, userId } = useLibraryUser()
  return useQuery({
    queryKey: libraryKeys.follow(userId, slug),
    queryFn: () => api.getFollowStatus(slug),
    enabled: !!user,
  })
}

export function useToggleFollow(slug: string) {
  const { userId } = useLibraryUser()
  const queryClient = useQueryClient()
  const key = libraryKeys.follow(userId, slug)

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
    onSettled: () => queryClient.invalidateQueries({ queryKey: libraryKeys.all(userId) }),
  })
}

export function useLibrary() {
  const { user, userId } = useLibraryUser()
  return useQuery({
    queryKey: libraryKeys.list(userId),
    queryFn: api.getLibrary,
    enabled: !!user,
  })
}

/** Số truyện đang theo dõi có chương mới; 0 khi chưa đăng nhập */
export function useLibraryUpdateCount() {
  const { user, userId } = useLibraryUser()
  return useQuery({
    queryKey: libraryKeys.updates(userId),
    queryFn: api.getLibraryUpdateCount,
    enabled: !!user,
  })
}

export function useReadingHistory(limit?: number) {
  const { userId, sessionPending } = useLibraryUser()
  return useQuery({
    queryKey: libraryKeys.history(userId, limit),
    queryFn: () => api.getReadingHistory(limit),
    // Đợi biết là khách hay đã đăng nhập, tránh tải lịch sử khách rồi đổi ngay
    enabled: !sessionPending,
  })
}

export function useStoryProgress(slug: string) {
  const { userId, sessionPending } = useLibraryUser()
  return useQuery({
    queryKey: libraryKeys.progress(userId, slug),
    queryFn: () => api.getStoryProgress(slug),
    enabled: !sessionPending,
  })
}

/**
 * Ghi chỗ đang đọc (mở chương, cuộn). Chỉ cập nhật chỗ đọc của truyện đó trong cache;
 * các danh sách khác được đánh dấu cũ để tự tải lại khi mở, không tải lại mỗi lần cuộn.
 */
export function useSaveReadingProgress() {
  const { userId } = useLibraryUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.saveReadingProgress,
    onSuccess: (entry: ReadingProgress) => {
      queryClient.setQueryData(libraryKeys.progress(userId, entry.slug), entry)
      void queryClient.invalidateQueries({
        queryKey: libraryKeys.all(userId),
        refetchType: 'none',
      })
    },
  })
}

function useInvalidateLibrary() {
  const { userId } = useLibraryUser()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: libraryKeys.all(userId) })
}

export function useRemoveFromHistory() {
  const invalidate = useInvalidateLibrary()
  return useMutation({ mutationFn: api.removeFromHistory, onSuccess: invalidate })
}

export function useClearHistory() {
  const invalidate = useInvalidateLibrary()
  return useMutation({ mutationFn: api.clearHistory, onSuccess: invalidate })
}
