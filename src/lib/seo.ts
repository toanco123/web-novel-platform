// Thẻ SEO của từng trang (title, description, canonical, Open Graph). Dùng ở cả client (component
// Seo) và hàm Vercel api/meta (chèn thẻ vào index.html cho bot), để hai nơi ra cùng một bộ thẻ.
// Hàm Vercel biên dịch từng file và giữ nguyên đường dẫn import, nên file này (và file nó import)
// không dùng alias @/ hay import.meta, và import tương đối ghi đuôi .js.
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_TAGLINE } from '../config/site.js'
import { paths } from './routes.js'

export type PageSeo = {
  title: string
  description?: string
  /** Đường dẫn chuẩn của trang (bắt đầu bằng "/", không kèm query); không có thì không có canonical */
  path?: string
  /** Ảnh xem trước (ảnh bìa). Không có hoặc không phải URL http(s) thì dùng ảnh mặc định của web */
  image?: string | null
  type?: 'website' | 'book' | 'article'
  /** Trang riêng tư hoặc không có nội dung: không cho máy tìm kiếm lập chỉ mục */
  noindex?: boolean
}

export type SeoTag = { tag: 'meta' | 'link'; attrs: Record<string, string> }

const DESCRIPTION_MAX = 160

/** Mô tả cho thẻ meta: một dòng, tối đa 160 ký tự, cắt ở ranh giới từ */
export function metaDescription(text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line.length <= DESCRIPTION_MAX) return line
  const cut = line.slice(0, DESCRIPTION_MAX - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

const meta = (name: string, content: string): SeoTag => ({ tag: 'meta', attrs: { name, content } })
const og = (property: string, content: string): SeoTag => ({
  tag: 'meta',
  attrs: { property, content },
})

/** Các thẻ trong <head> của một trang, trừ <title>. siteUrl: địa chỉ web, vd https://ten-mien.vn */
export function seoTags(seo: PageSeo, siteUrl: string): SeoTag[] {
  if (seo.noindex) return [meta('robots', 'noindex')]
  const origin = siteUrl.replace(/\/+$/, '')
  const url = seo.path ? origin + seo.path : null
  const cover = seo.image && /^https?:\/\//.test(seo.image) ? seo.image : null
  const suffix = ` | ${SITE_NAME}`
  // Tên web đã có ở og:site_name
  const title = seo.title.endsWith(suffix) ? seo.title.slice(0, -suffix.length) : seo.title

  return [
    ...(seo.description ? [meta('description', seo.description)] : []),
    ...(url ? [{ tag: 'link', attrs: { rel: 'canonical', href: url } } satisfies SeoTag] : []),
    og('og:site_name', SITE_NAME),
    og('og:locale', 'vi_VN'),
    og('og:type', seo.type ?? 'website'),
    og('og:title', title),
    ...(seo.description ? [og('og:description', seo.description)] : []),
    ...(url ? [og('og:url', url)] : []),
    og('og:image', cover ?? origin + DEFAULT_OG_IMAGE),
    // Ảnh bìa là ảnh dọc nên dùng thẻ nhỏ; ảnh mặc định của web là ảnh ngang 1200×630
    meta('twitter:card', cover ? 'summary' : 'summary_large_image'),
  ]
}

type StorySeoInput = {
  slug: string
  title: string
  authorName: string
  description: string
  coverUrl: string | null
}

export const homeSeo = (): PageSeo => ({
  title: `${SITE_NAME}: đọc truyện chữ online`,
  description: SITE_TAGLINE,
  path: paths.home,
})

export const storySeo = (story: StorySeoInput): PageSeo => ({
  title: `${story.title} - ${story.authorName} | ${SITE_NAME}`,
  description: metaDescription(story.description),
  path: paths.story(story.slug),
  image: story.coverUrl,
  type: 'book',
})

export function chapterSeo(
  story: Omit<StorySeoInput, 'description'>,
  chapter: { number: number; title: string },
): PageSeo {
  const name = chapter.title
    ? `Chương ${chapter.number}: ${chapter.title}`
    : `Chương ${chapter.number}`
  const quoted = chapter.title ? ` "${chapter.title}"` : ''
  return {
    title: `${name} - ${story.title} | ${SITE_NAME}`,
    description: metaDescription(
      `Đọc chương ${chapter.number}${quoted} của truyện ${story.title} (${story.authorName}).`,
    ),
    path: paths.chapter(story.slug, chapter.number),
    image: story.coverUrl,
    type: 'article',
  }
}

export const genreSeo = (genre: {
  slug: string
  name: string
  description?: string | null
}): PageSeo => ({
  title: `Truyện ${genre.name} | ${SITE_NAME}`,
  description: genre.description
    ? metaDescription(genre.description)
    : `Truyện ${genre.name} mới cập nhật, đọc miễn phí trên ${SITE_NAME}.`,
  path: paths.genre(genre.slug),
})
