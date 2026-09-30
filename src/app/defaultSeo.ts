/**
 * Gỡ các thẻ SEO mặc định mà bản build gắn sẵn vào index.html (seo.config.ts, đánh dấu data-seo).
 * Chúng chỉ dành cho bot không chạy JS; khi app chạy, mỗi trang tự đặt thẻ của mình bằng <Seo>.
 */
export function removeDefaultSeoTags() {
  for (const tag of document.head.querySelectorAll('[data-seo]')) tag.remove()
}
