import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import type { Score } from '@/types/comment'
import * as api from './api'

export const commentKeys = {
  story: (slug: string) => ['comments', slug] as const,
  /** chapter = null: bình luận của cả truyện */
  list: (slug: string, chapter: number | null = null) =>
    ['comments', slug, chapter ?? 'story'] as const,
  rating: (slug: string) => ['rating', slug] as const,
  myRating: (slug: string, userId: string) => ['rating', slug, 'me', userId] as const,
}

export const useComments = (slug: string, chapter: number | null = null) =>
  useInfiniteQuery({
    queryKey: commentKeys.list(slug, chapter),
    queryFn: ({ pageParam }) => api.getComments(slug, { chapter, cursor: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  })

export function useAddComment(slug: string, chapter: number | null = null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => api.addComment(slug, content, chapter),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.list(slug, chapter) }),
  })
}

export function useDeleteComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.deleteComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.story(slug) }),
  })
}

export const useRatingSummary = (slug: string) =>
  useQuery({ queryKey: commentKeys.rating(slug), queryFn: () => api.getRatingSummary(slug) })

export function useMyRating(slug: string) {
  const { data: user } = useSession()
  return useQuery({
    queryKey: commentKeys.myRating(slug, user?.id ?? 'guest'),
    queryFn: () => api.getMyRating(slug),
    enabled: !!user,
  })
}

export function useRateStory(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (score: Score) => api.rateStory(slug, score),
    // Điểm của truyện người dùng đăng tính từ lượt chấm thật, nên làm mới cả thông tin truyện
    onSuccess: () =>
      Promise.all(
        [commentKeys.rating(slug), ['stories']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
