// Hàm Vercel: trả index.html của app đã chèn thẻ SEO của trang (title, description, canonical, Open
// Graph) cho bot không chạy JS (Facebook, Zalo, Telegram...) và máy tìm kiếm. vercel.json chỉ
// chuyển request của bot (theo user-agent) sang đây; người đọc thường nhận index.html tĩnh.
// Plan: documents/plan-seo-va-xem-truoc-link.md
import { DEFAULT_SITE_URL } from '../src/config/site.js'
import { supabaseData } from './_lib/data.js'
import { fallbackHtml, injectSeo } from './_lib/html.js'
import { resolvePage } from './_lib/page.js'

/** index.html của chính bản deploy này (file tĩnh); null nếu không tải được */
async function loadShell(origin: string) {
  try {
    const response = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(3000) })
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  // Rewrite giữ nguyên địa chỉ gốc trong request.url
  const url = new URL(request.url)
  const siteUrl = process.env.VITE_SITE_URL || DEFAULT_SITE_URL
  const [page, shell] = await Promise.all([
    resolvePage(url.pathname, supabaseData(), siteUrl),
    loadShell(url.origin),
  ])
  const html = shell
    ? injectSeo(shell, page.seo, siteUrl, page.jsonLd)
    : fallbackHtml(page.seo, siteUrl, page.jsonLd)

  return new Response(html, {
    status: page.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Cache ở CDN của Vercel; mỗi bản deploy có cache riêng nên không giữ index.html cũ
      'cache-control':
        page.status === 200
          ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
          : 'public, max-age=0, s-maxage=60',
      ...(page.seo.noindex ? { 'x-robots-tag': 'noindex' } : {}),
    },
  })
}

export const HEAD = GET
