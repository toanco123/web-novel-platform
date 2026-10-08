import {
  keepPreviousData,
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { ChapterNotSavedError, readChapter } from '@/features/offline/readChapter'
import type { ChapterContent, ChapterOrder } from '@/types/chapter'
import * as api from './api'

export { chapterKeys, chapterListQuery } from './queries'
import { chapterKeys, chapterListQuery } from './queries'

export const useChapterList = (slug: string, page: number, order: ChapterOrder) =>
  useQuery({ ...chapterListQuery(slug, page, order), placeholderData: keepPreviousData })

/**
 * Query một chương cho trang đọc, qua kho trên máy (features/offline). networkMode 'always': mặc
 * định TanStack Query dừng query khi máy offline, trang đọc sẽ kẹt ở khung chờ dù chương đã lưu.
 */
export const chapterQuery = (queryClient: QueryClient, slug: string, number: number) =>
  queryOptions({
    queryKey: chapterKeys.detail(slug, number),
    queryFn: async () => {
      // Bản trên máy chủ có thể về trước khi truy vấn trả bản lưu: khi đó trả luôn bản mới, vì ghi
      // cache lúc truy vấn chưa xong sẽ bị bản lưu đè lại
      let settled = false
      let early: { chapter: ChapterContent | null } | undefined
      const saved = await readChapter(slug, number, (fresh) => {
        if (settled) queryClient.setQueryData(chapterKeys.detail(slug, number), fresh)
        else early = { chapter: fresh }
      })
      settled = true
      return early ? early.chapter : saved
    },
    networkMode: 'always',
    // Chưa lưu mà mất mạng: báo ngay, thử lại cũng vậy
    retry: (count, error) => !(error instanceof ChapterNotSavedError) && count < 3,
  })

export function useChapter(slug: string, number: number) {
  const queryClient = useQueryClient()
  return useQuery(chapterQuery(queryClient, slug, number))
}

/** Lấy một chương qua cache (dùng ngoài render, vd giọng đọc cần nội dung chương kế) */
export function useFetchChapter() {
  const queryClient = useQueryClient()
  return useCallback(
    (slug: string, number: number) =>
      queryClient.fetchQuery(chapterQuery(queryClient, slug, number)),
    [queryClient],
  )
}

/** Số chương đã xuất bản từ chương `from` trở đi (hộp thoại tải về đọc offline) */
export const useChapterCountFrom = (slug: string, from: number) =>
  useQuery({
    queryKey: chapterKeys.countFrom(slug, from),
    queryFn: () => api.countChaptersFrom(slug, from),
  })

/** Tính 1 lượt đọc khi mở chương */
export function useRecordChapterView(slug: string, number: number | undefined) {
  useEffect(() => {
    if (number !== undefined) void api.recordChapterView(slug, number)
  }, [slug, number])
}
