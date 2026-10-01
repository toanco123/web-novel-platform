---
name: seo-public-page
description: Dùng khi thêm trang công khai mới hoặc đổi đường dẫn một trang, sửa thẻ SEO (title, description, canonical, Open Graph, noindex), sitemap.xml, robots.txt, xem trước link khi chia sẻ (Facebook, Zalo, Telegram), sửa hàm Vercel trong api/, hoặc đổi SITE_NAME hay địa chỉ web.
---

# Trang công khai và SEO

App là SPA. Người đọc nhận thẻ từ `<Seo>` trong React. Bot không chạy JS (Facebook, Zalo, Telegram, Google...) được `vercel.json` chuyển theo user-agent sang hàm `api/meta.ts`; hàm này trả `index.html` đã chèn thẻ của trang, và trả 404 cho truyện, chương, thể loại không có. Hai nơi dựng thẻ từ cùng `src/lib/seo.ts`, nên trang mới phải khai báo ở cả hai. Plan: `documents/plan-seo-va-xem-truoc-link.md`.

## Thêm trang công khai

1. Đường dẫn tiếng Anh trong `paths` (`src/lib/routes.ts`). Route trong `src/app/router.tsx` dạng `lazy: page(() => import('@/pages/...'))`; file trang `export default`.
2. Thẻ của trang: `<Seo {...} />` (`components/common/Seo`).
   - **Trang tĩnh** (không đọc dữ liệu): thêm tiêu đề và mô tả vào `STATIC_PAGES` (`src/lib/seo.ts`), trang dùng `<Seo {...staticPageSeo(paths.x)} />`. `matchRoute` tự nhận trang qua `STATIC_PAGES`.
   - **Trang theo dữ liệu** (như truyện, chương, thể loại): viết hàm `xxxSeo` trong `src/lib/seo.ts`, thêm kiểu `Route` và regex vào `matchRoute` (`api/_lib/html.ts`), rồi đọc dữ liệu và dựng thẻ trong `switch` của `api/_lib/page.ts` (đọc Supabase ở `api/_lib/data.ts`). Không có dữ liệu thì trả 404.
3. Sitemap: trang tĩnh thêm vào `STATIC_PATHS` (`api/_lib/sitemap.ts`, danh sách riêng, không tự lấy từ `STATIC_PAGES`); trang theo dữ liệu thêm vào `sitemapEntries` (`api/_lib/data.ts`).
4. Đổi đường dẫn cũ: thêm redirect 301 (`"permanent": true`) trong `vercel.json`.
5. Test: `src/test/seo.test.tsx` (thẻ trong `<head>`), `api/_lib/html.test.ts` (`matchRoute`), `api/_lib/page.test.ts`, `api/_lib/sitemap.test.ts`. Chạy `npx vitest run src/test/seo.test.tsx api`.

## Trang riêng tư

Trang cần đăng nhập, tìm kiếm, 404: `<Seo noindex ...>`, hoặc `<NoIndex />` ở khung của cả khu. Khu riêng tư mới thêm vào regex `PRIVATE` trong `api/_lib/html.ts` (nếu không, bot nhận 404). Không đưa vào sitemap.

## File dùng chung với hàm Vercel

`src/lib/seo.ts`, `src/lib/routes.ts`, `src/config/site.ts` và mọi file trong `api/` không được dùng alias `@/` hay `import.meta`, và import tương đối phải ghi đuôi `.js`: Vercel biên dịch từng file và giữ nguyên đường dẫn import. Thư mục `api/_lib/` bắt đầu bằng `_` nên không thành hàm.

## Thẻ mặc định, địa chỉ web, ảnh xem trước

- `robots.txt` và thẻ mặc định trong `index.html` (`data-seo="default"`) do plugin `seo.config.ts` sinh lúc build. Thẻ có `data-seo` (thẻ mặc định và thẻ `data-seo="page"` do `api/meta` chèn) được app gỡ khi khởi động (`src/app/defaultSeo.ts`), để không trùng với thẻ của `<Seo>`.
- Địa chỉ web: `DEFAULT_SITE_URL` (`src/config/site.ts`), ghi đè bằng `VITE_SITE_URL`; client đọc qua `SITE_URL` (`src/lib/siteUrl.ts`).
- Ảnh xem trước mặc định `public/og-default.png` có tên web: đổi `SITE_NAME` thì làm lại ảnh.

## Thử với bot

Rewrite có `has` (theo user-agent) không chạy với `vercel dev`. Thử trên bản deploy:

```bash
vercel deploy
vercel curl /story/<slug> --deployment <url> -- -A "facebookexternalhit/1.1"
```

Bản preview có lớp đăng nhập Vercel, nên hàm trả trang tối giản (chỉ có thẻ) thay vì `index.html`.
