import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/hooks'
import type { ChapterStatus } from '@/types/chapter'
import type { ChapterReport } from '@/types/report'
import * as api from './api'

export const studioKeys = {
  all: (userId: string) => ['studio', userId] as const,
  stories: (userId: string) => ['studio', userId, 'stories'] as const,
  story: (userId: string, id: string) => ['studio', userId, 'story', id] as const,
  chapters: (userId: string, id: string) => ['studio', userId, 'chapters', id] as const,
  chapter: (userId: string, id: string, n: number) => ['studio', userId, 'chapter', id, n] as const,
  stats: (userId: string, id: string) => ['studio', userId, 'stats', id] as const,
  reports: (userId: string, id: string) => ['studio', userId, 'reports', id] as const,
}

function useUserId() {
  return useSession().data?.id ?? 'guest'
}

/** Sau mọi thay đổi: làm mới khu Sáng tác và các danh sách công khai (trang chủ, chi tiết, thể loại) */
function useInvalidateAll() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return () =>
    Promise.all(
      [studioKeys.all(userId), ['stories'], ['chapters'], ['genres']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    )
}

export function useMyStories() {
  const userId = useUserId()
  return useQuery({ queryKey: studioKeys.stories(userId), queryFn: api.getMyStories })
}

export function useMyStory(id: string) {
  const userId = useUserId()
  return useQuery({ queryKey: studioKeys.story(userId, id), queryFn: () => api.getMyStory(id) })
}

export function useMyChapters(storyId: string) {
  const userId = useUserId()
  return useQuery({
    queryKey: studioKeys.chapters(userId, storyId),
    queryFn: () => api.getMyChapters(storyId),
  })
}

export function useMyChapter(storyId: string, number: number | null) {
  const userId = useUserId()
  return useQuery({
    queryKey: studioKeys.chapter(userId, storyId, number ?? 0),
    queryFn: () => api.getMyChapter(storyId, number!),
    enabled: number !== null,
  })
}

export function useCreateStory() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: api.createStory, onSuccess: invalidate })
}

export function useUpdateStory(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: api.StoryInput) => api.updateStory(id, input),
    onSuccess: invalidate,
  })
}

export function useSetStoryVisibility(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (publish: boolean) => (publish ? api.publishStory(id) : api.unpublishStory(id)),
    onSuccess: invalidate,
  })
}

export function useDeleteStory(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: () => api.deleteStory(id), onSuccess: invalidate })
}

export function useSaveChapter(storyId: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ publish, ...input }: api.ChapterInput & { number?: number; publish: boolean }) =>
      api.saveChapter(storyId, input, { publish }),
    onSuccess: invalidate,
  })
}

export function useSetChapterStatus(storyId: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ number, status }: { number: number; status: ChapterStatus }) =>
      api.setChapterStatus(storyId, number, status),
    onSuccess: invalidate,
  })
}

export function useDeleteChapter(storyId: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (number: number) => api.deleteChapter(storyId, number),
    onSuccess: invalidate,
  })
}

export function useImportChapters(storyId: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ items, publish }: { items: api.ChapterInput[]; publish: boolean }) =>
      api.importChapters(storyId, items, publish),
    onSuccess: invalidate,
  })
}

export function useStoryStats(storyId: string) {
  const userId = useUserId()
  return useQuery({
    queryKey: studioKeys.stats(userId, storyId),
    queryFn: () => api.getStoryStats(storyId),
  })
}

export function useStoryReports(storyId: string) {
  const userId = useUserId()
  return useQuery({
    queryKey: studioKeys.reports(userId, storyId),
    queryFn: () => api.getStoryReports(storyId),
  })
}

export function useSetReportStatus(storyId: string) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ChapterReport['status'] }) =>
      api.setReportStatus(storyId, id, status),
    // Làm mới danh sách báo lỗi và số báo lỗi trên tab/danh sách truyện
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studioKeys.all(userId) }),
  })
}
