// Query key và query mục lục chương, tách khỏi hooks.ts để route loader (bundle chính) import được
// mà không kéo theo kho đọc offline (IndexedDB) mà chapterQuery dùng
import { queryOptions } from '@tanstack/react-query'
import type { ChapterOrder } from '@/types/chapter'
import * as api from './api'

export const chapterKeys = {
  list: (slug: string, page: number, order: ChapterOrder) =>
    ['chapters', slug, 'list', page, order] as const,
  detail: (slug: string, number: number) => ['chapters', slug, 'detail', number] as const,
  countFrom: (slug: string, from: number) => ['chapters', slug, 'count-from', from] as const,
}

/** Một trang mục lục chương (dùng chung cho hook và route loader của trang truyện) */
export const chapterListQuery = (slug: string, page: number, order: ChapterOrder) =>
  queryOptions({
    queryKey: chapterKeys.list(slug, page, order),
    queryFn: () => api.getChapterList(slug, { page, order }),
  })
