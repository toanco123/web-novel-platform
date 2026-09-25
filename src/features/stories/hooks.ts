import { keepPreviousData, useQuery } from '@tanstack/react-query'
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

export const useStory = (slug: string) =>
  useQuery({ queryKey: storyKeys.detail(slug), queryFn: () => api.getStory(slug) })

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

export const useSearchStories = (query: string, page: number) =>
  useQuery({
    queryKey: storyKeys.search(query, page),
    queryFn: () => api.searchStories(query, page),
    enabled: query.trim().length > 0,
    placeholderData: keepPreviousData,
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
