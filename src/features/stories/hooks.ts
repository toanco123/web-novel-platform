import { useQuery } from '@tanstack/react-query'
import * as api from './api'

export const storyKeys = {
  featured: ['stories', 'featured'] as const,
  editorPicks: ['stories', 'editor-picks'] as const,
  trendingWeekly: ['stories', 'trending-weekly'] as const,
  latestUpdated: ['stories', 'latest-updated'] as const,
  newReleases: ['stories', 'new-releases'] as const,
  detail: (slug: string) => ['stories', 'detail', slug] as const,
  byGenre: (genreSlug: string) => ['stories', 'by-genre', genreSlug] as const,
  byAuthor: (authorSlug: string, exclude: string) =>
    ['stories', 'by-author', authorSlug, exclude] as const,
  related: (slug: string) => ['stories', 'related', slug] as const,
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

export const useStoriesByGenre = (genreSlug: string) =>
  useQuery({
    queryKey: storyKeys.byGenre(genreSlug),
    queryFn: () => api.getStoriesByGenre(genreSlug),
  })
