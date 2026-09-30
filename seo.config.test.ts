import { expect, test } from 'vitest'
import { defaultHeadTags, robotsTxt } from './seo.config.ts'

test('robots.txt chỉ chặn hàm api và trang tìm kiếm, trỏ tới sitemap bằng địa chỉ tuyệt đối', () => {
  const lines = robotsTxt('https://web.example/').split('\n')
  expect(lines).toContain('User-agent: *')
  expect(lines.filter((l) => l.startsWith('Disallow:'))).toEqual([
    'Disallow: /api/',
    'Disallow: /search',
  ])
  expect(lines).toContain('Sitemap: https://web.example/sitemap.xml')
})

test('thẻ mặc định trong index.html: thẻ chung của web, không có canonical hay og:url', () => {
  const tags = defaultHeadTags('https://web.example')
  const keys = tags.map((t) => t.attrs.name ?? t.attrs.property ?? t.attrs.rel)
  expect(keys).toEqual(
    expect.arrayContaining(['description', 'og:site_name', 'og:title', 'og:image', 'twitter:card']),
  )
  // Trang nào cũng dùng chung index.html nên không được gắn địa chỉ của riêng trang chủ
  expect(keys).not.toContain('canonical')
  expect(keys).not.toContain('og:url')
  expect(tags.find((t) => t.attrs.property === 'og:image')?.attrs.content).toBe(
    'https://web.example/og-default.png',
  )
  // Đánh dấu để app và hàm api/meta gỡ đi khi đặt thẻ của từng trang
  expect(tags.every((t) => t.attrs['data-seo'] === 'default' && t.injectTo === 'head')).toBe(true)
})
