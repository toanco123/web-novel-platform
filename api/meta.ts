// Hàm Vercel: trả index.html của app đã chèn thẻ SEO của trang (title, description, canonical, Open
// Graph) cho bot không chạy JS (Facebook, Zalo, Telegram...) và máy tìm kiếm. vercel.json chỉ
// chuyển request của bot (theo user-agent) sang đây; người đọc thường nhận index.html tĩnh.
// Plan: documents/plan-seo-va-xem-truoc-link.md
import { DEFAULT_SITE_URL } from '../src/config/site.js'
import { supabaseData } from './_lib/data.js'
import { fallbackHtml, injectSeo, isAppShell } from './_lib/html.js'
import { cacheControl, resolvePage } from './_lib/page.js'

/** index.html của chính bản deploy này (file tĩnh), thử 2 lần; null nếu không tải được */
async function loadShell(origin: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(2500) })
      const html = response.ok ? await response.text() : ''
      if (isAppShell(html)) return html
    } catch {
      // thử lại
    }
  }
  return null
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
      'cache-control': cacheControl(page, shell !== null),
      ...(page.seo.noindex ? { 'x-robots-tag': 'noindex' } : {}),
    },
  })
}

export const HEAD = GET
