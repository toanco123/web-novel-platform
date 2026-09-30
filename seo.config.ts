// Phần SEO làm lúc build: robots.txt (cần địa chỉ tuyệt đối của sitemap nên không để tĩnh trong
// public/) và thẻ mặc định trong index.html. Sitemap do hàm api/sitemap sinh (vercel.json chuyển
// /sitemap.xml sang đó).
import type { HtmlTagDescriptor, Plugin } from 'vite'
import { homeSeo, seoTags } from './src/lib/seo.ts'

/** Khu không có nội dung cho máy tìm kiếm (cần đăng nhập, hoặc trùng lặp như trang tìm kiếm) */
const DISALLOWED = ['/admin', '/studio', '/account', '/library', '/auth', '/api/', '/search']

export function robotsTxt(siteUrl: string) {
  return [
    'User-agent: *',
    ...DISALLOWED.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml`,
    '',
  ].join('\n')
}

/**
 * Thẻ chung của web gắn sẵn vào index.html, cho bot không chạy JS mà không đi qua hàm api/meta
 * (trang chủ "/" là file tĩnh nên Vercel trả thẳng, và các bot ngoài danh sách trong vercel.json).
 * Mọi trang dùng chung index.html nên không có canonical hay og:url. App gỡ các thẻ này khi khởi
 * động (src/app/defaultSeo.ts), hàm api/meta thay bằng thẻ của trang.
 */
export function defaultHeadTags(siteUrl: string) {
  return seoTags({ ...homeSeo(), path: undefined }, siteUrl).map(({ tag, attrs }) => {
    const marked: Record<string, string> = { ...attrs, 'data-seo': 'default' }
    return { tag, attrs: marked, injectTo: 'head' } satisfies HtmlTagDescriptor
  })
}

/** siteUrl: địa chỉ web (VITE_SITE_URL hoặc DEFAULT_SITE_URL) */
export function seoFiles(siteUrl: string): Plugin {
  return {
    name: 'seo-files',
    transformIndexHtml: () => defaultHeadTags(siteUrl),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
    },
  }
}
