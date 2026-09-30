// Phần thuần của hàm api/meta: nhận ra trang từ đường dẫn và chèn thẻ SEO vào index.html.
// Import tương đối ghi đuôi .js: Vercel biên dịch từng file .ts thành .js và giữ nguyên đường dẫn.
import { SITE_NAME } from '../../src/config/site.js'
import { type PageSeo, seoTags, STATIC_PAGES } from '../../src/lib/seo.js'

export type Route =
  | { kind: 'home' }
  | { kind: 'story'; slug: string }
  | { kind: 'chapter'; slug: string; number: number }
  | { kind: 'genre'; slug: string }
  /** Trang công khai không cần đọc dữ liệu (STATIC_PAGES: danh sách, bảng xếp hạng, trang thông tin) */
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

const PRIVATE =
  /^\/(search|library|account|login|register|forgot-password|reset-password|auth|studio|admin)(\/|$)/

/** Trang ứng với một đường dẫn (pathname, không kèm query) */
export function matchRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '' || path === '/') return { kind: 'home' }
  if (PRIVATE.test(path)) return { kind: 'private' }
  if (Object.hasOwn(STATIC_PAGES, path)) return { kind: 'page', path }
  const chapter = CHAPTER.exec(path)
  if (chapter) return { kind: 'chapter', slug: chapter[1], number: Number(chapter[2]) }
  const story = STORY.exec(path)
  if (story) return { kind: 'story', slug: story[1] }
  const genre = GENRE.exec(path)
  if (genre) return { kind: 'genre', slug: genre[1] }
  return { kind: 'missing' }
}

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

/**
 * Trang tối giản chỉ có thẻ: dùng khi không tải được index.html của app. Bot chỉ cần thẻ; người đọc
 * thật lọt vào đây (user-agent của trình duyệt trong app Zalo cũng có chữ "Zalo") thì trang tự tải
 * lại sau 3 giây để vào app khi lỗi tạm thời qua đi.
 */
export function fallbackHtml(seo: PageSeo, siteUrl: string, jsonLd?: object) {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="3">
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

/** Đúng là index.html của app, không phải trang báo lỗi hay trang đăng nhập của bản preview trên Vercel */
export const isAppShell = (html: string) =>
  /<title>[^<]*<\/title>/.test(html) && html.includes('</head>') && html.includes('id="root"')

/**
 * index.html của app với <title> và thẻ SEO của trang (thay cho thẻ mặc định có sẵn). shell không
 * phải index.html của app thì trả trang tối giản.
 */
export function injectSeo(shell: string, seo: PageSeo, siteUrl: string, jsonLd?: object) {
  if (!isAppShell(shell)) return fallbackHtml(seo, siteUrl, jsonLd)
  // Hàm thay thế: tên truyện có "$&"... không bị hiểu là mẫu thay thế
  return shell
    .replace(DEFAULT_TAG, '')
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(seo.title)}</title>`)
    .replace('</head>', () => `  ${renderTags(seo, siteUrl, jsonLd)}\n  </head>`)
}
