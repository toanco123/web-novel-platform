import { removeServerSeoTags } from './defaultSeo'

test('gỡ thẻ SEO có sẵn trong HTML (mặc định của bản build và thẻ do api/meta chèn), giữ thẻ khác', () => {
  document.head.innerHTML = `
    <meta name="viewport" content="width=device-width">
    <meta name="description" content="Mặc định" data-seo="default">
    <meta property="og:title" content="Mặc định" data-seo="default">
    <link rel="canonical" href="https://web.example/story/x" data-seo="page">
    <script type="application/ld+json">{"@type":"Book"}</script>`
  removeServerSeoTags()
  expect(document.head.querySelector('[data-seo]')).toBeNull()
  expect(document.head.querySelector('meta[name="viewport"]')).not.toBeNull()
  // JSON-LD chỉ hàm api/meta đặt, app không dựng lại nên giữ nguyên
  expect(document.head.querySelector('script[type="application/ld+json"]')).not.toBeNull()
  document.head.innerHTML = ''
})
