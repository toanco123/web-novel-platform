import { expect, test } from 'vitest'
import { SITE_NAME, SITE_TAGLINE } from '../../src/config/site.js'
import { cacheControl, type PageData, resolvePage, type StoryInfo } from './page.js'

const SITE = 'https://web.example'
const story: StoryInfo = {
  slug: 'mua-ha',
  title: 'Mùa Hạ Năm Ấy',
  description: 'Một câu chuyện tình học trò.',
  authorName: 'Linh',
  coverUrl: 'https://cdn.example/covers/a.webp',
  genres: ['Ngôn tình', 'Hiện đại'],
  ratingAvg: 4.5,
  ratingCount: 12,
}
const data: PageData = {
  story: async (slug) => (slug === story.slug ? story : null),
  chapter: async (slug, number) =>
    slug === story.slug && number === 3 ? { title: 'Cơn mưa đầu mùa' } : null,
  genre: async (slug) =>
    slug === 'co-dai' ? { slug, name: 'Cổ đại', description: 'Bối cảnh xưa.' } : null,
}
const failing: PageData = {
  story: () => Promise.reject(new Error('mất mạng')),
  chapter: () => Promise.reject(new Error('mất mạng')),
  genre: () => Promise.reject(new Error('mất mạng')),
}

test('trang truyện: thẻ theo truyện và JSON-LD kiểu Book', async () => {
  const page = await resolvePage('/story/mua-ha', data, SITE)
  expect(page.status).toBe(200)
  expect(page.seo).toMatchObject({
    title: `Mùa Hạ Năm Ấy - Linh | ${SITE_NAME}`,
    path: '/story/mua-ha',
    image: story.coverUrl,
    type: 'book',
  })
  expect(page.jsonLd).toMatchObject({
    '@type': 'Book',
    name: 'Mùa Hạ Năm Ấy',
    author: { '@type': 'Person', name: 'Linh' },
    url: 'https://web.example/story/mua-ha',
    image: story.coverUrl,
    genre: ['Ngôn tình', 'Hiện đại'],
    aggregateRating: { ratingValue: 4.5, ratingCount: 12 },
  })
})

test('truyện chưa ai chấm điểm thì JSON-LD không có aggregateRating', async () => {
  const unrated: PageData = {
    ...data,
    story: async () => ({ ...story, ratingCount: 0, ratingAvg: 0, coverUrl: null }),
  }
  const { jsonLd } = await resolvePage('/story/mua-ha', unrated, SITE)
  expect(jsonLd).not.toHaveProperty('aggregateRating')
  expect(jsonLd).not.toHaveProperty('image')
})

test('trang chương dùng ảnh bìa của truyện', async () => {
  const page = await resolvePage('/story/mua-ha/chapter-3', data, SITE)
  expect(page.status).toBe(200)
  expect(page.seo).toMatchObject({
    title: `Chương 3: Cơn mưa đầu mùa - Mùa Hạ Năm Ấy | ${SITE_NAME}`,
    path: '/story/mua-ha/chapter-3',
    image: story.coverUrl,
    type: 'article',
  })
})

test('trang thể loại và trang chủ', async () => {
  expect((await resolvePage('/genres/co-dai', data, SITE)).seo).toMatchObject({
    title: `Truyện Cổ đại | ${SITE_NAME}`,
    description: 'Bối cảnh xưa.',
    path: '/genres/co-dai',
  })
  expect(await resolvePage('/', data, SITE)).toMatchObject({
    status: 200,
    seo: { description: SITE_TAGLINE, path: '/' },
  })
})

test.each([
  '/story/khong-co',
  '/story/mua-ha/chapter-99',
  '/story/khong-co/chapter-3',
  '/genres/khong-co',
  '/khong-co-trang-nay',
])('%s không tồn tại: 404 và noindex', async (path) => {
  const page = await resolvePage(path, data, SITE)
  expect(page.status).toBe(404)
  expect(page.seo.noindex).toBe(true)
  expect(page.jsonLd).toBeUndefined()
})

test('khu riêng tư: 200 và noindex', async () => {
  expect(await resolvePage('/admin/users', data, SITE)).toMatchObject({
    status: 200,
    seo: { noindex: true },
  })
})

test('Supabase lỗi thì trả thẻ mặc định với mã 200, không báo 404 oan', async () => {
  for (const path of ['/story/mua-ha', '/story/mua-ha/chapter-3', '/genres/co-dai']) {
    const page = await resolvePage(path, failing, SITE)
    expect(page.status).toBe(200)
    expect(page.seo).toEqual({ title: SITE_NAME, description: SITE_TAGLINE })
    expect(page.degraded).toBe(true)
  }
  expect((await resolvePage('/story/mua-ha', data, SITE)).degraded).toBeUndefined()
})

test('trang tĩnh dùng mô tả riêng của trang, giống thẻ app tự đặt', async () => {
  expect((await resolvePage('/ranking', data, SITE)).seo).toEqual({
    title: `Bảng xếp hạng truyện | ${SITE_NAME}`,
    description: 'Truyện đọc nhiều, đánh giá cao và được theo dõi nhiều nhất.',
    path: '/ranking',
  })
})

test('cache ở CDN: chỉ cache trang đủ dữ liệu, không giữ bản cũ sau khi hết hạn', async () => {
  const ok = await resolvePage('/story/mua-ha', data, SITE)
  expect(cacheControl(ok, true)).toBe('public, max-age=0, s-maxage=300')
  const notFound = await resolvePage('/story/khong-co', data, SITE)
  expect(cacheControl(notFound, true)).toBe('public, max-age=0, s-maxage=60')
  // Thiếu dữ liệu (Supabase lỗi) hoặc thiếu index.html: không cache, lần sau thử lại ngay
  expect(cacheControl(await resolvePage('/story/mua-ha', failing, SITE), true)).toBe('no-store')
  expect(cacheControl(ok, false)).toBe('no-store')
})
