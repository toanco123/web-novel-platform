import { SITE_NAME, SITE_TAGLINE } from '@/config/site'
import { chapterSeo, genreSeo, homeSeo, metaDescription, seoTags, storySeo } from './seo'

const SITE = 'https://web.example'
const story = {
  slug: 'mua-ha-nam-ay',
  title: 'Mùa Hạ Năm Ấy',
  authorName: 'Linh',
  description: 'Một câu chuyện tình học trò.\n\nNhẹ nhàng,   kết thúc có hậu.',
  coverUrl: 'https://cdn.example/covers/a.webp',
}
/** Thẻ theo name/property/rel → content/href */
const byKey = (tags: ReturnType<typeof seoTags>) =>
  Object.fromEntries(
    tags.map((t) => [
      t.attrs.name ?? t.attrs.property ?? t.attrs.rel,
      t.attrs.content ?? t.attrs.href,
    ]),
  )

test('metaDescription gom khoảng trắng và cắt theo ranh giới từ', () => {
  expect(metaDescription(' Dòng một.\n\n Dòng   hai. ')).toBe('Dòng một. Dòng hai.')
  const long = metaDescription('chữ '.repeat(100))
  expect(long.length).toBeLessThanOrEqual(160)
  expect(long.endsWith('chữ…')).toBe(true)
})

test('trang truyện: canonical, Open Graph và ảnh bìa', () => {
  const seo = storySeo(story)
  expect(seo.title).toBe(`Mùa Hạ Năm Ấy - Linh | ${SITE_NAME}`)
  const tags = seoTags(seo, SITE)
  expect(byKey(tags)).toMatchObject({
    description: 'Một câu chuyện tình học trò. Nhẹ nhàng, kết thúc có hậu.',
    canonical: 'https://web.example/story/mua-ha-nam-ay',
    'og:site_name': SITE_NAME,
    'og:type': 'book',
    // Tên web đã có ở og:site_name nên tiêu đề chia sẻ không lặp lại
    'og:title': 'Mùa Hạ Năm Ấy - Linh',
    'og:description': 'Một câu chuyện tình học trò. Nhẹ nhàng, kết thúc có hậu.',
    'og:url': 'https://web.example/story/mua-ha-nam-ay',
    'og:image': 'https://cdn.example/covers/a.webp',
    'twitter:card': 'summary',
  })
  expect(tags.find((t) => t.attrs.rel === 'canonical')?.tag).toBe('link')
})

test('không có ảnh bìa dùng được thì lấy ảnh mặc định của web', () => {
  for (const coverUrl of [null, 'data:image/webp;base64,AAAA']) {
    expect(byKey(seoTags(storySeo({ ...story, coverUrl }), SITE))).toMatchObject({
      'og:image': 'https://web.example/og-default.png',
      'twitter:card': 'summary_large_image',
    })
  }
})

test('trang chương, thể loại và trang chủ', () => {
  expect(chapterSeo(story, { number: 3, title: 'Cơn mưa đầu mùa' })).toMatchObject({
    title: `Chương 3: Cơn mưa đầu mùa - Mùa Hạ Năm Ấy | ${SITE_NAME}`,
    description: 'Đọc chương 3 "Cơn mưa đầu mùa" của truyện Mùa Hạ Năm Ấy (Linh).',
    path: '/story/mua-ha-nam-ay/chapter-3',
    image: story.coverUrl,
    type: 'article',
  })
  expect(chapterSeo(story, { number: 4, title: '' })).toMatchObject({
    title: `Chương 4 - Mùa Hạ Năm Ấy | ${SITE_NAME}`,
    description: 'Đọc chương 4 của truyện Mùa Hạ Năm Ấy (Linh).',
  })
  expect(genreSeo({ slug: 'co-dai', name: 'Cổ đại', description: '' })).toMatchObject({
    title: `Truyện Cổ đại | ${SITE_NAME}`,
    description: `Truyện Cổ đại mới cập nhật, đọc miễn phí trên ${SITE_NAME}.`,
    path: '/genres/co-dai',
  })
  expect(
    genreSeo({ slug: 'co-dai', name: 'Cổ đại', description: 'Bối cảnh xưa.' }).description,
  ).toBe('Bối cảnh xưa.')
  expect(homeSeo()).toMatchObject({ description: SITE_TAGLINE, path: '/' })
})

test('địa chỉ web có dấu / ở cuối không làm canonical bị hai dấu /', () => {
  expect(byKey(seoTags(homeSeo(), 'https://web.example/')).canonical).toBe('https://web.example/')
})

test('noindex: chỉ có thẻ robots, không có canonical hay Open Graph', () => {
  const tags = seoTags({ title: 'Tìm kiếm', path: '/search', noindex: true }, SITE)
  expect(tags).toEqual([{ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } }])
})

test('trang không có đường dẫn chuẩn thì không có canonical và og:url', () => {
  const keys = Object.keys(byKey(seoTags({ title: 'Trang' }, SITE)))
  expect(keys).not.toContain('canonical')
  expect(keys).not.toContain('og:url')
  expect(keys).toContain('og:title')
})
