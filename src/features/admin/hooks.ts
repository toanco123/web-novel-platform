import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import type { CuratedList } from '@/types/story'
import * as api from './api'
import { importStory } from './bulkImport'

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

export function useAdminComments(query: api.AdminCommentQuery) {
  const userId = useUserId()
  return useQuery({
    queryKey: [...adminKeys.all(userId), 'comments', query],
    queryFn: () => api.getAdminComments(query),
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

/** Duyệt / từ chối truyện: làm mới cả danh sách công khai (truyện vừa duyệt hiện ra ngay) */
export function useReviewStory() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (input: api.ReviewInput) => api.reviewStory(input),
    onSettled: () =>
      Promise.all(
        [adminKeys.all(userId), ['stories'], ['chapters'], ['genres']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

export const useDismissCommentReports = () =>
  useAdminMutation((commentId: string) => api.dismissCommentReports(commentId))

/** Xóa bình luận: làm mới cả bình luận ở phần công khai */
export function useDeleteAdminComment() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (id: string) => api.deleteAdminComment(id),
    onSettled: () =>
      Promise.all(
        [adminKeys.all(userId), ['comments']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

/** Sửa/xóa/gộp thể loại: làm mới cả danh sách thể loại và truyện ở phần công khai */
function useGenreMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all(
        [adminKeys.all(userId), ['genres'], ['stories']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

export const useUpdateGenre = () =>
  useGenreMutation(
    ({ slug, name, description }: { slug: string; name: string; description: string }) =>
      api.updateGenre(slug, { name, description }),
  )

export const useDeleteGenre = () => useGenreMutation((slug: string) => api.deleteGenre(slug))

export const useMergeGenres = () =>
  useGenreMutation(({ from, into }: { from: string; into: string }) => api.mergeGenres(from, into))

export const useSetAdminReportStatus = () =>
  useAdminMutation(({ id, status }: { id: string; status: api.AdminReport['status'] }) =>
    api.setAdminReportStatus(id, status),
  )

export function useCuratedStories(list: CuratedList) {
  const userId = useUserId()
  return useQuery({
    queryKey: [...adminKeys.all(userId), 'curated', list],
    queryFn: () => api.getCuratedStories(list),
  })
}

/** Lưu danh sách chọn tay: làm mới cả trang chủ (key ['stories']) */
export function useSetCuratedStories() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ list, storyIds }: { list: CuratedList; storyIds: string[] }) =>
      api.setCuratedStories(list, storyIds),
    onSettled: () =>
      Promise.all(
        [adminKeys.all(userId), ['stories']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

/** Nhập một truyện từ file: xong thì làm mới danh sách truyện (công khai, Sáng tác, admin) */
export function useImportStory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importStory,
    onSettled: () =>
      Promise.all(
        [['admin'], ['studio'], ['stories'], ['genres']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
