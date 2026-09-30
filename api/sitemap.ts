// Hàm Vercel: sitemap.xml (vercel.json chuyển /sitemap.xml sang đây). Gồm các trang công khai tĩnh,
// từng thể loại có truyện và từng truyện công khai.
import { DEFAULT_SITE_URL } from '../src/config/site.js'
import { sitemapEntries } from './_lib/data.js'
import { buildSitemap, STATIC_PATHS } from './_lib/sitemap.js'

export async function GET() {
  const siteUrl = process.env.VITE_SITE_URL || DEFAULT_SITE_URL
  const pages = STATIC_PATHS.map((path) => ({ path }))
  // Supabase lỗi thì vẫn trả các trang tĩnh, và chỉ cache ngắn để lần sau thử lại
  const dynamic = await sitemapEntries().catch(() => null)

  return new Response(buildSitemap([...pages, ...(dynamic ?? [])], siteUrl), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': dynamic
        ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
        : 'public, max-age=0, s-maxage=60',
    },
  })
}

export const HEAD = GET
