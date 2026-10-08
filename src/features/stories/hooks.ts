import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Story } from '@/types/story'
import * as api from './api'

export const storyKeys = {
  featured: ['stories', 'featured'] as const,
  editorPicks: ['stories', 'editor-picks'] as const,
  trendingWeekly: ['stories', 'trending-weekly'] as const,
  latestUpdated: ['stories', 'latest-updated'] as const,
  newReleases: ['stories', 'new-releases'] as const,
  detail: (slug: string) => ['stories', 'detail', slug] as const,
  byAuthor: (authorSlug: string, exclude: string) =>
    ['stories', 'by-author', authorSlug, exclude] as const,
  related: (slug: string) => ['stories', 'related', slug] as const,
  browse: (filters: api.BrowseFilters) => ['stories', 'browse', filters] as const,
  search: (query: string, page: number) => ['stories', 'search', query, page] as const,
  suggestions: (query: string) => ['stories', 'suggestions', query] as const,
  ranking: (by: api.RankingCriterion, period: api.RankingPeriod) =>
    ['stories', 'ranking', by, period] as const,
}

export const useFeaturedStories = () =>
  useQuery({ queryKey: storyKeys.featured, queryFn: api.getFeaturedStories })
export const useEditorPicks = () =>
  useQuery({ queryKey: storyKeys.editorPicks, queryFn: () => api.getEditorPicks() })
export const useTrendingWeekly = () =>
  useQuery({ queryKey: storyKeys.trendingWeekly, queryFn: () => api.getTrendingWeekly() })
export const useLatestUpdated = () =>
  useQuery({ queryKey: storyKeys.latestUpdated, queryFn: () => api.getLatestUpdated() })
export const useNewReleases = () =>
  useQuery({ queryKey: storyKeys.newReleases, queryFn: () => api.getNewReleases() })

/**
 * Bấm từ thẻ truyện thì truyện đã có sẵn trong cache của danh sách (trang chủ, duyệt, tìm kiếm, xếp
 * hạng...), cùng kiểu `Story` với trang chi tiết (đều dựng từ story_cards): dùng làm placeholder để
 * hiện ngay phần đầu trang, phần còn lại tải sau
 */
export function useStory(slug: string, { enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: storyKeys.detail(slug),
    queryFn: () => api.getStory(slug),
    placeholderData: () => storyFromLists(queryClient, slug),
    enabled,
  })
}

function storyFromLists(queryClient: QueryClient, slug: string): Story | undefined {
  for (const [, data] of queryClient.getQueriesData({ queryKey: ['stories'] })) {
    const found = storiesIn(data).find((s) => s.slug === slug)
    if (found) return found
  }
  return undefined
}

/** Truyện trong dữ liệu của một query danh sách: Story[], RankedStory[] hoặc Page<Story> */
function storiesIn(data: unknown): Story[] {
  const list: unknown[] = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.items)
      ? data.items
      : []
  return list.flatMap((item) => {
    if (isStory(item)) return [item]
    if (isRecord(item) && isStory(item.story)) return [item.story]
    return []
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Chỉ nhận object đủ các trường phần đầu trang chi tiết cần */
function isStory(value: unknown): value is Story {
  return (
    isRecord(value) &&
    typeof value.slug === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.chapterCount === 'number' &&
    typeof value.visibility === 'string' &&
    isRecord(value.author) &&
    Array.isArray(value.genres) &&
    'firstChapterNumber' in value &&
    'latestChapter' in value &&
    'ownerId' in value
  )
}

export const useStoriesByAuthor = (authorSlug: string | undefined, excludeSlug: string) =>
  useQuery({
    queryKey: storyKeys.byAuthor(authorSlug ?? '', excludeSlug),
    queryFn: () => api.getStoriesByAuthor(authorSlug!, excludeSlug),
    enabled: !!authorSlug,
  })

export const useRelatedStories = (slug: string) =>
  useQuery({ queryKey: storyKeys.related(slug), queryFn: () => api.getRelatedStories(slug) })

/** Giữ kết quả cũ khi đổi bộ lọc/trang để lưới không nháy trống */
export const useBrowseStories = (filters: api.BrowseFilters) =>
  useQuery({
    queryKey: storyKeys.browse(filters),
    queryFn: () => api.browseStories(filters),
    placeholderData: keepPreviousData,
  })

/** Chỉ giữ kết quả cũ khi đổi trang của cùng từ khóa; từ khóa mới thì chờ (không hiện số cũ với từ mới) */
export const useSearchStories = (query: string, page: number) =>
  useQuery({
    queryKey: storyKeys.search(query, page),
    queryFn: () => api.searchStories(query, page),
    enabled: query.trim().length > 0,
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === query ? prev : undefined),
  })

export const useSearchSuggestions = (query: string) =>
  useQuery({
    queryKey: storyKeys.suggestions(query),
    queryFn: () => api.getSearchSuggestions(query),
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
  })

export const useRanking = (by: api.RankingCriterion, period: api.RankingPeriod) =>
  useQuery({
    queryKey: storyKeys.ranking(by, period),
    queryFn: () => api.getRanking({ by, period }),
    placeholderData: keepPreviousData,
  })
