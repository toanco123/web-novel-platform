import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import type { ChapterOrder } from '@/types/chapter'
import * as api from './api'

export const chapterKeys = {
  list: (slug: string, page: number, order: ChapterOrder) =>
    ['chapters', slug, 'list', page, order] as const,
  detail: (slug: string, number: number) => ['chapters', slug, 'detail', number] as const,
}

export const useChapterList = (slug: string, page: number, order: ChapterOrder) =>
  useQuery({
    queryKey: chapterKeys.list(slug, page, order),
    queryFn: () => api.getChapterList(slug, { page, order }),
    placeholderData: keepPreviousData,
  })

export const useChapter = (slug: string, number: number) =>
  useQuery({
    queryKey: chapterKeys.detail(slug, number),
    queryFn: () => api.getChapter(slug, number),
  })

/** Tải trước chương kế để bấm "Chương sau" là có ngay */
export function usePrefetchChapter(slug: string, number: number | undefined) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (number === undefined) return
    void queryClient.prefetchQuery({
      queryKey: chapterKeys.detail(slug, number),
      queryFn: () => api.getChapter(slug, number),
    })
  }, [queryClient, slug, number])
}

/** Tính 1 lượt đọc khi mở chương */
export function useRecordChapterView(slug: string, number: number | undefined) {
  useEffect(() => {
    if (number !== undefined) void api.recordChapterView(slug, number)
  }, [slug, number])
}

/** Lấy một chương qua cache (dùng ngoài render, vd giọng đọc cần nội dung chương kế) */
export function useFetchChapter() {
  const queryClient = useQueryClient()
  return useCallback(
    (slug: string, number: number) =>
      queryClient.fetchQuery({
        queryKey: chapterKeys.detail(slug, number),
        queryFn: () => api.getChapter(slug, number),
      }),
    [queryClient],
  )
}
