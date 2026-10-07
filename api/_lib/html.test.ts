import { expect, test } from 'vitest'
import indexHtml from '../../index.html?raw'
import { SITE_NAME } from '../../src/config/site.js'
import { paths } from '../../src/lib/routes.js'
import { STATIC_PAGES, storySeo } from '../../src/lib/seo.js'
import { fallbackHtml, injectSeo, isAppShell, matchRoute } from './html.js'

const SITE = 'https://web.example'

test('matchRoute nhận ra trang truyện, chương, thể loại', () => {
  expect(matchRoute('/')).toEqual({ kind: 'home' })
  expect(matchRoute('/story/mua-ha-nam-ay')).toEqual({ kind: 'story', slug: 'mua-ha-nam-ay' })
  expect(matchRoute('/story/mua-ha-nam-ay/')).toEqual({ kind: 'story', slug: 'mua-ha-nam-ay' })
  expect(matchRoute('/story/mua-ha-nam-ay/chapter-12')).toEqual({
    kind: 'chapter',
    slug: 'mua-ha-nam-ay',
    number: 12,
  })
  expect(matchRoute('/genres/co-dai')).toEqual({ kind: 'genre', slug: 'co-dai' })
  expect(matchRoute('/genres')).toEqual({ kind: 'page', path: '/genres' })
  expect(matchRoute('/list/completed')).toEqual({ kind: 'page', path: '/list/completed' })
})

test('matchRoute: đường dẫn lạ hoặc slug sai định dạng là không tồn tại', () => {
  for (const path of [
    '/khong-co-trang-nay',
    '/story/Có Dấu',
    '/story/a"b',
    '/story/abc/chapter-0',
    '/story/abc/chapter-x',
    '/story/abc/chapter-1/them',
    '/genres/a_b',
    '/list/khac',
    '/story/%E0%A4%A',
  ]) {
    expect(matchRoute(path), path).toEqual({ kind: 'missing' })
  }
})

test('matchRoute: khu riêng tư', () => {
  for (const path of [
    '/library',
    '/account',
    '/login',
    '/studio/story/1',
    '/admin/users',
    '/search',
  ]) {
    expect(matchRoute(path), path).toEqual({ kind: 'private' })
  }
})

test('mọi đường dẫn trong paths đều được matchRoute nhận ra (thêm trang mới thì nhớ khai báo)', () => {
  const samples = Object.values(paths).map((p) =>
    typeof p === 'string' ? p : (p as (...args: unknown[]) => string)('abc', 1),
  )
  for (const url of samples) {
    expect(matchRoute(url.split('?')[0]), url).not.toEqual({ kind: 'missing' })
  }
})

test('mọi trang tĩnh trong STATIC_PAGES đều được nhận ra', () => {
  for (const path of Object.keys(STATIC_PAGES)) {
    expect(matchRoute(path)).toEqual({ kind: 'page', path })
    expect(matchRoute(`${path}/`)).toEqual({ kind: 'page', path })
  }
})

test('injectSeo thay <title> và chèn thẻ vào head của index.html', () => {
  const seo = storySeo({
    slug: 'mua-ha',
    title: 'Mùa "Hạ" <b> & Em',
    authorName: 'Linh',
    description: 'Giới thiệu có "nháy" & <thẻ>.',
    coverUrl: 'https://cdn.example/a.webp?x=1&y=2',
  })
  const html = injectSeo(indexHtml, seo, SITE)
  expect(html.match(/<title>/g)).toHaveLength(1)
  expect(html).toContain(
    `<title>Mùa &quot;Hạ&quot; &lt;b&gt; &amp; Em - Linh | ${SITE_NAME}</title>`,
  )
  // data-seo="page": app gỡ các thẻ này khi khởi động rồi tự đặt thẻ bằng <Seo>, để bot chạy JS
  // không thấy mỗi thẻ hai lần
  expect(html).toContain(
    '<link rel="canonical" href="https://web.example/story/mua-ha" data-seo="page">',
  )
  expect(html).toContain(
    '<meta property="og:title" content="Mùa &quot;Hạ&quot; &lt;b&gt; &amp; Em - Linh" data-seo="page">',
  )
  expect(html).toContain(
    '<meta name="description" content="Giới thiệu có &quot;nháy&quot; &amp; &lt;thẻ&gt;." data-seo="page">',
  )
  expect(html).toContain(
    '<meta property="og:image" content="https://cdn.example/a.webp?x=1&amp;y=2" data-seo="page">',
  )
  // Thẻ nằm trong head, phần còn lại của app giữ nguyên
  expect(html.indexOf('og:title')).toBeLessThan(html.indexOf('</head>'))
  expect(html).toContain('<div id="root">')
  expect(html).toContain('class="app-shell"')
  expect(html).toContain('<script type="module"')
})

test('JSON-LD không đóng thẻ script sớm', () => {
  const seo = { title: 'T', path: '/story/x' }
  const html = injectSeo(indexHtml, seo, SITE, { name: '</script><script>alert(1)</script>' })
  expect(html).toContain('<script type="application/ld+json">')
  expect(html).not.toContain('</script><script>alert(1)')
  expect(html).toContain('\\u003c/script>')
})

test('không có index.html hợp lệ thì trả trang tối giản vẫn đủ thẻ', () => {
  const seo = { title: 'Tiêu đề', description: 'Mô tả', path: '/' }
  for (const shell of [null, '<html>không có head', 'Authentication Required']) {
    const html = shell ? injectSeo(shell, seo, SITE) : fallbackHtml(seo, SITE)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<title>Tiêu đề</title>')
    expect(html).toContain('<meta property="og:title" content="Tiêu đề" data-seo="page">')
    expect(html).toContain('<html lang="vi">')
  }
})

test('trang không phải index.html của app (vd trang đăng nhập của Vercel) thì không chèn vào', () => {
  const login =
    '<html><head><title>Protected Deployment</title></head><body>Đăng nhập</body></html>'
  const html = injectSeo(login, { title: 'Tiêu đề', path: '/' }, SITE)
  expect(html).not.toContain('Đăng nhập')
  expect(html).toContain('<title>Tiêu đề</title>')
})

test('thẻ mặc định của index.html (data-seo) được thay bằng thẻ của trang', () => {
  const shell = indexHtml.replace(
    '</head>',
    `<meta name="description" content="Mặc định" data-seo="default">
    <meta property="og:title" content="Mặc định" data-seo="default">
    <meta name="viewport-khac" content="giữ lại">
  </head>`,
  )
  const html = injectSeo(shell, { title: 'Trang', description: 'Mô tả trang', path: '/x' }, SITE)
  expect(html).not.toContain('Mặc định')
  expect(html).toContain('content="giữ lại"')
  expect(html.match(/og:title/g)).toHaveLength(1)
  expect(html.match(/name="description"/g)).toHaveLength(1)
})

test('isAppShell chỉ nhận index.html của app', () => {
  expect(isAppShell(indexHtml)).toBe(true)
  expect(isAppShell('<html><head><title>Protected Deployment</title></head></html>')).toBe(false)
  expect(isAppShell('')).toBe(false)
})

test('trang tối giản tự tải lại để người đọc thật vào được app khi lỗi tạm thời qua đi', () => {
  expect(fallbackHtml({ title: 'T' }, SITE)).toContain('<meta http-equiv="refresh" content="3">')
})
