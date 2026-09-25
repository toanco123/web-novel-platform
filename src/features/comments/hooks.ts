import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import type { Score } from '@/types/comment'
import * as api from './api'

export const commentKeys = {
  list: (slug: string) => ['comments', slug] as const,
  rating: (slug: string) => ['rating', slug] as const,
  myRating: (slug: string, userId: string) => ['rating', slug, 'me', userId] as const,
}

export const useComments = (slug: string) =>
  useInfiniteQuery({
    queryKey: commentKeys.list(slug),
    queryFn: ({ pageParam }) => api.getComments(slug, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
  })

export function useAddComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => api.addComment(slug, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.list(slug) }),
  })
}

export function useDeleteComment(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.deleteComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.list(slug) }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.rating(slug) }),
  })
}
