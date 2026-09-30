# Plan: SEO và xem trước link khi chia sẻ

Trạng thái: đang làm (30/09/2026). Nhánh `seo-share-preview`.

## Context

Web là SPA: `index.html` chỉ có `<title>Web Truyện</title>`, mọi thẻ `<title>`/`<meta>` khác do React gắn sau khi JS chạy. Hệ quả:

- Link dán lên Facebook, Zalo, Telegram... không có tên truyện, mô tả hay ảnh bìa, vì bot của các nơi này không chạy JS.
- Chưa có thẻ Open Graph, canonical, `sitemap.xml`, `robots.txt`.
- Truyện không tồn tại vẫn trả mã 200 (soft 404).

## Phạm vi

1. Thẻ SEO trong app (component `Seo`): title, description, canonical, Open Graph, Twitter card; `noindex` cho trang riêng tư.
2. Hàm `api/meta` trên Vercel: chèn thẻ vào `index.html` cho bot.
3. `sitemap.xml` (hàm `api/sitemap`) và `robots.txt` (sinh lúc build).

Ngoài phạm vi: SSR cho người đọc, sinh ảnh xem trước riêng cho từng truyện, đưa trang chương vào sitemap, dữ liệu có cấu trúc ngoài trang truyện.

## 1. Địa chỉ web

- `DEFAULT_SITE_URL` trong `src/config/site.ts` = `https://web-novel-platform-gules.vercel.app`.
- Biến `VITE_SITE_URL` (không bắt buộc) ghi đè khi có tên miền riêng. Ba nơi đọc: client (`src/lib/siteUrl.ts`, `import.meta.env`), hàm Vercel (`process.env`), plugin build (`loadEnv`). Đổi tên miền thì khai báo biến này trên Vercel rồi deploy lại.

## 2. Thẻ SEO dùng chung (`src/lib/seo.ts`)

Một module thuần, dùng ở cả client và hàm Vercel, để hai nơi ra cùng một bộ thẻ:

- `PageSeo = { title, description?, path?, image?, type?, noindex?, jsonLd? }`.
- `seoTags(seo, siteUrl)` → danh sách thẻ `meta`/`link` (description, canonical, `og:*`, `twitter:card`, robots).
- `storySeo`, `chapterSeo`, `genreSeo`, `homeSeo`: dựng `PageSeo` từ dữ liệu.
- `metaDescription(text)`: gom khoảng trắng, cắt ở 160 ký tự theo ranh giới từ.

Quy tắc:

- Canonical = địa chỉ web + đường dẫn, không kèm query (`?page=`, `?sort=`...).
- Ảnh: ảnh bìa truyện nếu là URL `http(s)`; không có thì `/og-default.png` (1200×630). Thẻ `twitter:card` là `summary` khi dùng ảnh bìa (ảnh dọc), `summary_large_image` khi dùng ảnh mặc định.
- `noindex`: không có canonical và `og:*`, chỉ có `<meta name="robots" content="noindex">`.
- Module này và các file nó import không dùng alias `@/` hay `import.meta`, và import tương đối ghi đuôi `.js`: hàm Vercel biên dịch từng file, giữ nguyên đường dẫn import.

### Trang nào có gì

| Trang | Thẻ |
|---|---|
| Trang chủ, danh sách, thể loại, bảng xếp hạng, trang thông tin | title, description, canonical, OG (ảnh mặc định) |
| Truyện | như trên + ảnh bìa, `og:type = book` |
| Chương | như trên (ảnh bìa của truyện), `og:type = article`, giữ `rel="prev"/"next"` |
| Tìm kiếm, tủ truyện, tài khoản, đăng nhập/đăng ký/quên mật khẩu, Sáng tác, Quản trị, 404 | `noindex` |

## 3. Hàm `api/meta` cho bot

- `vercel.json` thêm một rewrite đứng trước rewrite SPA: request có `user-agent` của bot (Facebook, Zalo, Telegram, Twitter/X, Slack, Discord, WhatsApp, LinkedIn, Skype, Pinterest, Googlebot, Bingbot, Cốc Cốc...) và đường dẫn không bắt đầu bằng `api/`, `assets/` thì chuyển sang `/api/meta`. Người đọc thường vẫn nhận `index.html` tĩnh.
- Hàm nhận URL gốc trong `request.url`, tự tách đường dẫn:

| Đường dẫn | Dữ liệu | Không có |
|---|---|---|
| `/` | tên web + tagline | – |
| `/story/:slug` | `story_cards` (công khai, có chương) | 404 + `noindex` |
| `/story/:slug/chapter-:n` | chương đã xuất bản + truyện | 404 + `noindex` |
| `/genres/:slug` | `genre_cards` | 404 + `noindex` |
| `/search`, `/library`, `/account`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/*`, `/studio/*`, `/admin/*` | – | `noindex` |
| còn lại | tên web + tagline, canonical theo đường dẫn | – |

- Đọc Supabase qua REST bằng anon key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), nên RLS vẫn áp dụng. Slug sai định dạng coi như không có. Supabase lỗi hoặc quá 4 giây thì trả thẻ mặc định với mã 200 (không báo 404 oan).
- Hàm tải `/index.html` của chính bản deploy, thay `<title>` và chèn thẻ trước `</head>`. Bot có chạy JS (Google) vẫn nhận đúng app. Không tải được thì trả một trang HTML tối giản chỉ có thẻ.
- Trang truyện có thêm JSON-LD kiểu `Book` (tên, tác giả, mô tả, ảnh, thể loại, điểm đánh giá nếu có).
- Cache ở CDN: `s-maxage=300, stale-while-revalidate=86400` cho mã 200; `s-maxage=60` cho 404.

## 4. Sitemap và robots

- `/sitemap.xml` → rewrite sang `api/sitemap`: trang chủ, `/genres`, ba danh sách, bảng xếp hạng, bốn trang thông tin, từng thể loại có truyện, từng truyện công khai (`lastmod` = `updated_at`). Đọc `story_cards` theo lô 1.000, tối đa 45.000 truyện. Cache `s-maxage=3600`. Supabase lỗi thì vẫn trả các trang tĩnh.
- `robots.txt`: plugin Vite `seo.config.ts` sinh lúc build (cần địa chỉ tuyệt đối của sitemap). Chặn `/admin`, `/studio`, `/account`, `/library`, `/auth`, `/api`, `/search`.
- PWA: `navigateFallbackDenylist` thêm `/api/`, `/sitemap.xml`, `/robots.txt`; ảnh `og-default.png` không precache.

## 5. File

| File | Việc |
|---|---|
| `src/config/site.ts` | thêm `DEFAULT_SITE_URL`, `DEFAULT_OG_IMAGE` |
| `src/lib/seo.ts` (+ test) | `PageSeo`, `seoTags`, các hàm dựng, `metaDescription` |
| `src/lib/siteUrl.ts` | `SITE_URL` cho client |
| `src/components/common/Seo.tsx` | render `PageSeo` thành thẻ React |
| các trang trong `src/pages`, `InfoPage`, `NotFound`, layout | dùng `Seo` |
| `api/_lib/html.ts` (+ test) | `matchRoute`, `renderTags`, `injectSeo`, `fallbackHtml` |
| `api/_lib/data.ts` | đọc Supabase REST |
| `api/_lib/sitemap.ts` (+ test) | dựng XML |
| `api/meta.ts`, `api/sitemap.ts` | hai hàm Vercel |
| `seo.config.ts` (+ test) | plugin sinh `robots.txt` |
| `public/og-default.png` | ảnh xem trước mặc định |
| `vercel.json`, `pwa.config.ts`, `tsconfig.node.json`, `.env.example` | cấu hình |

Thư mục `api/_lib` bắt đầu bằng `_` nên Vercel không biến file trong đó thành hàm.

## 6. Kiểm tra

- Test đơn vị: `seoTags` (canonical bỏ query, ảnh mặc định, `noindex`), `metaDescription`, `matchRoute`, `injectSeo` (escape HTML trong tên truyện, JSON-LD không đóng thẻ `</script>` sớm), sitemap XML (escape `&`), `robots.txt`.
- Test tích hợp: mở trang truyện thì `document.head` có canonical và `og:title` đúng; trang tìm kiếm có `robots noindex`.
- Test `vercel.json`: rewrite của bot đứng trước rewrite SPA, không bắt `api/` và `assets/`.
- Trên bản preview của Vercel (`vercel deploy` rồi `vercel curl ... -A facebookexternalhit/1.1`): trang truyện có thẻ `og:*`, truyện không tồn tại trả 404, user-agent thường nhận `index.html` tĩnh, `/sitemap.xml` và `/robots.txt` đúng. `has` của rewrite không chạy với `vercel dev` nên phải thử trên bản deploy.
- Sau khi lên production: thử lại bằng `curl -A`, và dán link vào công cụ Sharing Debugger của Facebook.

## 7. Các bước

1. `src/lib/seo.ts` + test.
2. Component `Seo`, gắn vào các trang + test tích hợp.
3. `api/_lib/html.ts`, `api/_lib/data.ts`, `api/meta.ts` + test.
4. Sitemap, robots, cấu hình PWA + test.
5. `vercel.json` + test; ảnh `og-default.png`.
6. Thử trên bản preview; cập nhật `CLAUDE.md`, lộ trình; chạy toàn bộ test, lint, build; gộp vào `main`; thử lại trên production.
