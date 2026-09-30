// Dựng thẻ SEO cho một đường dẫn của app từ dữ liệu trên Supabase (hàm api/meta).
import { SITE_NAME, SITE_TAGLINE } from '../../src/config/site.js'
import {
  chapterSeo,
  genreSeo,
  homeSeo,
  metaDescription,
  type PageSeo,
  storySeo,
} from '../../src/lib/seo.js'
import { matchRoute, missingSeo, privateSeo, staticPageSeo } from './html.js'

export type StoryInfo = {
  slug: string
  title: string
  description: string
  authorName: string
  coverUrl: string | null
  /** Tên các thể loại */
  genres: string[]
  ratingAvg: number
  ratingCount: number
}

/** Nguồn dữ liệu: null là không có (hoặc không công khai); lỗi mạng thì ném lỗi */
export type PageData = {
  story(slug: string): Promise<StoryInfo | null>
  /** Chương đã xuất bản của truyện */
  chapter(slug: string, number: number): Promise<{ title: string } | null>
  genre(slug: string): Promise<{ slug: string; name: string; description: string | null } | null>
}

export type ResolvedPage = { status: 200 | 404; seo: PageSeo; jsonLd?: object }

const found = (seo: PageSeo, jsonLd?: object): ResolvedPage => ({ status: 200, seo, jsonLd })
const missing = (): ResolvedPage => ({ status: 404, seo: missingSeo() })

/** Dữ liệu có cấu trúc schema.org cho trang truyện */
function storyJsonLd(story: StoryInfo, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: story.title,
    author: { '@type': 'Person', name: story.authorName },
    description: metaDescription(story.description),
    url,
    inLanguage: 'vi',
    ...(story.coverUrl ? { image: story.coverUrl } : {}),
    ...(story.genres.length ? { genre: story.genres } : {}),
    ...(story.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: story.ratingAvg,
            ratingCount: story.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
}

async function resolve(pathname: string, data: PageData, siteUrl: string): Promise<ResolvedPage> {
  const route = matchRoute(pathname)
  switch (route.kind) {
    case 'home':
      return found(homeSeo())
    case 'page':
      return found(staticPageSeo(route.path))
    case 'private':
      return found(privateSeo())
    case 'missing':
      return missing()
    case 'story': {
      const story = await data.story(route.slug)
      if (!story) return missing()
      const seo = storySeo(story)
      return found(seo, storyJsonLd(story, siteUrl.replace(/\/+$/, '') + seo.path))
    }
    case 'chapter': {
      const [story, chapter] = await Promise.all([
        data.story(route.slug),
        data.chapter(route.slug, route.number),
      ])
      if (!story || !chapter) return missing()
      return found(chapterSeo(story, { number: route.number, title: chapter.title }))
    }
    case 'genre': {
      const genre = await data.genre(route.slug)
      return genre ? found(genreSeo(genre)) : missing()
    }
  }
}

/**
 * Thẻ và mã trạng thái cho một đường dẫn. Không đọc được dữ liệu (Supabase lỗi, quá thời gian) thì
 * trả thẻ chung của web với mã 200: thà thiếu thẻ riêng còn hơn báo 404 cho trang đang có.
 */
export async function resolvePage(
  pathname: string,
  data: PageData,
  siteUrl: string,
): Promise<ResolvedPage> {
  try {
    return await resolve(pathname, data, siteUrl)
  } catch {
    return found({ title: SITE_NAME, description: SITE_TAGLINE })
  }
}
