import { removeDefaultSeoTags } from './defaultSeo'

test('gỡ thẻ SEO mặc định của index.html, giữ các thẻ khác', () => {
  document.head.innerHTML = `
    <meta name="viewport" content="width=device-width">
    <meta name="description" content="Mặc định" data-seo="default">
    <meta property="og:title" content="Mặc định" data-seo="default">`
  removeDefaultSeoTags()
  expect(document.head.querySelector('[data-seo]')).toBeNull()
  expect(document.head.querySelector('meta[name="viewport"]')).not.toBeNull()
  document.head.innerHTML = ''
})
