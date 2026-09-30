/**
 * Gỡ các thẻ SEO có sẵn trong HTML (đánh dấu data-seo): thẻ mặc định bản build gắn vào index.html
 * (seo.config.ts) và thẻ của trang do hàm api/meta chèn cho bot. Chúng dành cho bot không chạy JS;
 * khi app chạy, mỗi trang tự đặt thẻ của mình bằng <Seo>, nên để lại sẽ thành hai bộ thẻ.
 */
export function removeServerSeoTags() {
  for (const tag of document.head.querySelectorAll('[data-seo]')) tag.remove()
}
