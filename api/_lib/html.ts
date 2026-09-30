// Phần thuần của hàm api/meta: nhận ra trang từ đường dẫn và chèn thẻ SEO vào index.html.
// Import tương đối ghi đuôi .js: Vercel biên dịch từng file .ts thành .js và giữ nguyên đường dẫn.
import { SITE_NAME, SITE_TAGLINE } from '../../src/config/site.js'
import { type PageSeo, seoTags } from '../../src/lib/seo.js'

export type Route =
  | { kind: 'home' }
  | { kind: 'story'; slug: string }
  | { kind: 'chapter'; slug: string; number: number }
  | { kind: 'genre'; slug: string }
  /** Trang công khai không cần đọc dữ liệu (danh sách, bảng xếp hạng, trang thông tin) */
  | { kind: 'page'; path: string }
  /** Khu cần đăng nhập và trang không có nội dung riêng: không cho lập chỉ mục */
  | { kind: 'private' }
  /** Đường dẫn app không có: trả 404 */
  | { kind: 'missing' }

/** Slug truyện và thể loại (ràng buộc ở DB); giá trị khác không bao giờ khớp dữ liệu */
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const STORY = new RegExp(`^/story/(${SLUG})$`)
const CHAPTER = new RegExp(`^/story/(${SLUG})/chapter-([1-9][0-9]{0,8})$`)
const GENRE = new RegExp(`^/genres/(${SLUG})$`)

/** Tiêu đề các trang công khai tĩnh (như <title> của chính trang đó trong src/pages) */
const PAGES: Record<string, string> = {
  '/genres': 'Thể loại truyện',
  '/list/latest': 'Truyện mới cập nhật',
  '/list/completed': 'Truyện full',
  '/list/ongoing': 'Truyện đang ra',
  '/ranking': 'Bảng xếp hạng truyện',
  '/about': `Về ${SITE_NAME}`,
  '/contact': 'Liên hệ',
  '/terms': 'Điều khoản sử dụng',
  '/privacy': 'Chính sách bảo mật',
}

const PRIVATE =
  /^\/(search|library|account|login|register|forgot-password|reset-password|auth|studio|admin)(\/|$)/

/** Trang ứng với một đường dẫn (pathname, không kèm query) */
export function matchRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '' || path === '/') return { kind: 'home' }
  if (PRIVATE.test(path)) return { kind: 'private' }
  if (path in PAGES) return { kind: 'page', path }
  const chapter = CHAPTER.exec(path)
  if (chapter) return { kind: 'chapter', slug: chapter[1], number: Number(chapter[2]) }
  const story = STORY.exec(path)
  if (story) return { kind: 'story', slug: story[1] }
  const genre = GENRE.exec(path)
  if (genre) return { kind: 'genre', slug: genre[1] }
  return { kind: 'missing' }
}

export const staticPageSeo = (path: string): PageSeo => ({
  title: `${PAGES[path]} | ${SITE_NAME}`,
  description: SITE_TAGLINE,
  path,
})

export const privateSeo = (): PageSeo => ({ title: SITE_NAME, noindex: true })
export const missingSeo = (): PageSeo => ({
  title: `Không tìm thấy trang | ${SITE_NAME}`,
  noindex: true,
})

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Các thẻ của một trang dưới dạng HTML (không gồm <title>) */
function renderTags(seo: PageSeo, siteUrl: string, jsonLd?: object) {
  const tags = seoTags(seo, siteUrl).map(({ tag, attrs }) => {
    const pairs = Object.entries(attrs).map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    return `<${tag} ${pairs.join(' ')}>`
  })
  // "<" viết thành < để nội dung không đóng thẻ script sớm
  if (jsonLd && !seo.noindex) {
    const json = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
    tags.push(`<script type="application/ld+json">${json}</script>`)
  }
  return tags.join('\n    ')
}

/** Trang tối giản chỉ có thẻ: dùng khi không tải được index.html của app */
export function fallbackHtml(seo: PageSeo, siteUrl: string, jsonLd?: object) {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8">
    <title>${escapeHtml(seo.title)}</title>
    ${renderTags(seo, siteUrl, jsonLd)}
  </head>
  <body>
    <h1>${escapeHtml(seo.title)}</h1>
    ${seo.description ? `<p>${escapeHtml(seo.description)}</p>` : ''}
  </body>
</html>
`
}

/** Thẻ SEO mặc định mà bản build gắn sẵn vào index.html (seo.config.ts đánh dấu data-seo) */
const DEFAULT_TAG = /[ \t]*<(?:meta|link)\b[^>]*\bdata-seo="default"[^>]*>\n?/g

/**
 * index.html của app với <title> và thẻ SEO của trang (thay cho thẻ mặc định có sẵn). shell không
 * phải index.html của app (trang báo lỗi, trang đăng nhập của bản preview trên Vercel) thì trả trang
 * tối giản.
 */
export function injectSeo(shell: string, seo: PageSeo, siteUrl: string, jsonLd?: object) {
  const isApp =
    /<title>[^<]*<\/title>/.test(shell) && shell.includes('</head>') && shell.includes('id="root"')
  if (!isApp) return fallbackHtml(seo, siteUrl, jsonLd)
  // Hàm thay thế: tên truyện có "$&"... không bị hiểu là mẫu thay thế
  return shell
    .replace(DEFAULT_TAG, '')
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(seo.title)}</title>`)
    .replace('</head>', () => `  ${renderTags(seo, siteUrl, jsonLd)}\n  </head>`)
}
