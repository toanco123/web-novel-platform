import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as store from './store'

export const offlineKeys = {
  all: ['offline'] as const,
  stories: ['offline', 'stories'] as const,
  chapters: (slug: string) => ['offline', 'chapters', slug] as const,
}

// Kho nằm trên máy: chạy cả khi offline (networkMode 'always'), mỗi lần mở đều đọc lại (staleTime 0)
const local = { networkMode: 'always', staleTime: 0 } as const

export const useSavedStories = () =>
  useQuery({ queryKey: offlineKeys.stories, queryFn: store.listSavedStories, ...local })

export const useSavedChapters = (slug: string) =>
  useQuery({
    queryKey: offlineKeys.chapters(slug),
    queryFn: () => store.savedChapterList(slug),
    ...local,
  })

function useInvalidateOffline() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: offlineKeys.all })
}

export function useRemoveSavedStory() {
  const invalidate = useInvalidateOffline()
  return useMutation({
    mutationFn: store.removeSavedStory,
    networkMode: 'always',
    onSuccess: invalidate,
  })
}

export function useClearSaved() {
  const invalidate = useInvalidateOffline()
  return useMutation({ mutationFn: store.clearSaved, networkMode: 'always', onSuccess: invalidate })
}
