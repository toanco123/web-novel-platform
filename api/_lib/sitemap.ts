// Dựng sitemap.xml (hàm api/sitemap). Chưa có trang chương: mỗi truyện có thể tới hàng nghìn chương,
// vượt giới hạn 50.000 địa chỉ của một file; máy tìm kiếm tới chương qua link trên trang truyện.

export type SitemapEntry = {
  /** Đường dẫn trong web, bắt đầu bằng "/" */
  path: string
  /** Lần cập nhật gần nhất (ISO); không hợp lệ thì bỏ qua */
  lastmod?: string | null
}

/** Trang công khai không phụ thuộc dữ liệu */
export const STATIC_PATHS = [
  '/',
  '/genres',
  '/list/latest',
  '/list/completed',
  '/list/ongoing',
  '/ranking',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
]

const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export function buildSitemap(entries: SitemapEntry[], siteUrl: string) {
  const origin = siteUrl.replace(/\/+$/, '')
  const urls = entries.map(({ path, lastmod }) => {
    const day = lastmod && /^\d{4}-\d{2}-\d{2}/.exec(lastmod)?.[0]
    return `  <url><loc>${escapeXml(origin + path)}</loc>${day ? `<lastmod>${day}</lastmod>` : ''}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}
