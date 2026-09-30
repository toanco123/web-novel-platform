import { expect, test } from 'vitest'
import { buildSitemap, STATIC_PATHS } from './sitemap.js'

test('sitemap có địa chỉ tuyệt đối, lastmod dạng ngày và escape ký tự XML', () => {
  const xml = buildSitemap(
    [
      { path: '/' },
      { path: '/story/mua-ha', lastmod: '2026-09-30T08:15:00.123456+00:00' },
      { path: '/genres/a&b', lastmod: 'không phải ngày' },
    ],
    'https://web.example/',
  )
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  expect(xml).toContain('<url><loc>https://web.example/</loc></url>')
  expect(xml).toContain(
    '<url><loc>https://web.example/story/mua-ha</loc><lastmod>2026-09-30</lastmod></url>',
  )
  expect(xml).toContain('<url><loc>https://web.example/genres/a&amp;b</loc></url>')
})

test('trang tĩnh trong sitemap là các trang công khai, không có khu riêng tư', () => {
  expect(STATIC_PATHS).toContain('/')
  expect(STATIC_PATHS).toContain('/ranking')
  for (const path of STATIC_PATHS) {
    expect(path).not.toMatch(/^\/(admin|studio|account|library|search|login)/)
  }
})
