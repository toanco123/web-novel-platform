# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tổng quan

Web đọc **truyện chữ** (kiểu TruyenFull/Wattpad), dạng SPA: Vite + React 19 + TypeScript + Tailwind CSS v4, backend là **Supabase**. Mọi feature đã có bản nối Supabase; khi chưa cấu hình Supabase (và luôn luôn trong test) app chạy bằng dữ liệu giả (mock) trong localStorage.

Plan tổng (bố cục từng trang, route, schema DB, lộ trình) nằm ở [documents/plan-bo-cuc-va-cong-nghe.md](documents/plan-bo-cuc-va-cong-nghe.md) — đọc file này trước khi làm tính năng mới. Khi viết plan mới hoặc xong một bước trong lộ trình, cập nhật/đánh dấu tiến độ trong `documents/`. Người dùng giao tiếp bằng tiếng Việt; tài liệu viết bằng tiếng Việt.

## Lệnh

```bash
npm run dev          # dev server, host/port lấy từ .env (HOST, PORT; mặc định localhost:3000, strictPort)
npm run build        # tsc -b && vite build
npm run typecheck    # tsc -b
npm run lint         # oxlint (không dùng ESLint)
npm run format       # prettier --write . (có plugin sắp xếp class Tailwind)
npm test             # vitest run (jsdom)
npx vitest run src/test/smoke.test.tsx   # chạy 1 file test
npx vitest run -t "tên test"             # chạy test theo tên
npx shadcn@latest add <component>        # thêm component shadcn vào src/components/ui
npx vitest run api                       # test của hàm Vercel (api/_lib)
```

## Kiến trúc

- **Entry**: `src/main.tsx` → `Providers` (`src/app/providers.tsx`: TanStack Query + TooltipProvider) → `RouterProvider` (import từ `react-router/dom`).
- **Routing**: React Router **v8**, data mode, khai báo tập trung ở `src/app/router.tsx` (mảng `routes` được export để test dùng lại). Mỗi trang lazy-load qua helper `page(() => import(...))`, nên file trong `src/pages/` dùng `export default`. Mỗi layout gốc có `HydrateFallback: PageLoader` — bỏ đi sẽ gây warning. Đường dẫn, tên và giá trị tham số trên URL đều bằng **tiếng Anh** (`/story/:slug`, `/story/:slug/chapter-:number`, `/genres/:slug`, `/search`, `/library?tab=history`, `?page=2`...); chỉ slug truyện/thể loại là dữ liệu nên giữ nguyên. Link cũ tiếng Việt (`/truyen/...`, `/dang-nhap`...) được `vercel.json` chuyển hướng 301 sang đường dẫn mới.
- **Layouts**: `MainLayout` (header + footer) cho trang thường; `AuthLayout` (panel bìa truyện + form, không header/footer) cho đăng nhập/đăng ký/quên & đặt lại mật khẩu; `ReaderLayout` (không header/footer, áp màu nền theo cài đặt đọc) cho trang đọc chương.
- **Auth**: phiên đăng nhập nằm trong TanStack Query (`useSession`, key `['auth', 'session']`); các mutation trong `features/auth/hooks.ts` cập nhật cache bằng `setQueryData`. Bản giả `features/auth/api.mock.ts` lưu `localStorage` (`mock-auth-users`, `mock-auth-session`; tài khoản demo `demo@webtruyen.vn` / `matkhau123`, chỉ có ở bản giả). Chuyển hướng sau đăng nhập dùng `?next=` và luôn đi qua `safeNext()` (chống open redirect); tạo link bằng `paths.login(next)` / `paths.register(next)`. Cách ánh xạ sang Supabase ghi ở mục 6 `documents/plan-dang-nhap-dang-ky.md`.
- **Dữ liệu giả có ghi**: lưu `localStorage` qua `readMock`/`writeMock` (`src/lib/mockStorage.ts`). Dữ liệu hoạt động của người đọc mà nhiều api cùng dùng (theo dõi, lịch sử đọc, lượt đọc, chấm điểm, bình luận, báo lỗi) gom ở `src/mocks/activity.ts`: api này không đọc thẳng key localStorage của api khác. Thao tác cần đăng nhập gọi `requireUser()` của auth api (ném `AuthError` mã `unauthenticated`). Query key có dữ liệu riêng từng người luôn chứa `userId` (khách dùng `'guest'`) để đổi tài khoản không lẫn cache. Dữ liệu giả sinh cố định theo slug bằng `seededRandom` (`src/lib/seededRandom.ts`).
- **Tủ truyện & lịch sử đọc** (`features/library`, trang `/library?tab=following|history`):
  - Theo dõi lưu mốc `seenChapter`; số chương mới = chương xuất bản sau mốc (hiện ở tủ truyện và chấm trên avatar).
  - Lịch sử đọc có cả cho khách, gộp vào tài khoản ở lần đầu đăng nhập. Bản giả lưu dưới khóa `guest` của `mocks/activity.ts`; bản Supabase lưu ở `features/library/guestHistory.ts` (localStorage `reading-history-guest`) rồi gộp bằng `rpc('merge_guest_history')`.
  - Link "Đọc tiếp" truyền `state` từ `resumeState()` để trang đọc cuộn tới chỗ đọc dở.
- **Danh mục giả**: `src/mocks/catalog.ts` gộp truyện có sẵn với truyện người dùng (`src/mocks/userContent.ts`, localStorage); mọi api đọc truyện/chương/thể loại phải lấy qua `catalog()`/`findStory()`/`readerChapters()`, không đọc thẳng `mocks/stories.ts`. Truyện nháp chỉ hiện với chủ truyện; danh sách công khai chỉ lấy truyện có ≥ 1 chương đã xuất bản. `Story.latestChapter`/`firstChapterNumber` có thể `null`, và `ratingCount` có thể bằng 0.
- **Sáng tác** (`/studio/*`, bọc `RequireAuth` qua `pages/studio/StudioShell`): api ở `features/studio/api.ts`, mọi hàm kiểm tra chủ truyện (truyện của người khác → `not_found`). Form tạo truyện (`StoryForm` với `firstChapter`) có phần chương đầu tiên không bắt buộc (chọn được số chương, mặc định 1): "Lưu nháp" hoặc "Đăng truyện" (xuất bản chương đó và công khai truyện luôn). Trang quản lý truyện có tab Thống kê (`getStoryStats`) và Báo lỗi (`getStoryReports`/`setReportStatus`); tab đang mở nằm trên URL (`?tab=`, tạo link bằng `paths.studioStory(id, tab)`). Quy tắc: truyện chỉ xuất bản khi có ≥ 1 chương đã xuất bản; truyện đang công khai không được ẩn/xóa chương công khai cuối cùng; số chương do tác giả chọn (mặc định số tiếp theo, được bỏ trống số ở giữa, `saveChapter` nhận `newNumber`), chương đã từng xuất bản giữ nguyên số; xóa chương thì xóa luôn bình luận và báo lỗi của chương. Ô nội dung chương là trình soạn Tiptap có thanh định dạng (`features/studio/editor`, chỉ nằm trong chunk Sáng tác; plan `documents/plan-trinh-soan-dinh-dang.md`), nối form bằng `useController`. Mutation của studio invalidate cả key công khai (`['stories']`, `['chapters']`, `['genres']`). Dữ liệu lớn ghi bằng `writeMockStrict` (ném `StorageFullError` khi localStorage đầy). Lỗi hiển thị qua `studioErrorMessage`. Plan: `documents/plan-sang-tac-va-the-loai.md`.
- **Quản trị** (`/admin/*`: tổng quan, người dùng + khóa, truyện + gỡ, chọn truyện cho trang chủ, hộp thư, báo lỗi, bình luận, thể loại, nhập truyện hàng loạt): api ở `features/admin/api.ts` (RPC `admin_*` DEFINER ở `private`, tự kiểm tra `private.require_admin()`), trang ở `pages/admin` (`AdminShell` bọc `RequireAuth`, người không phải quản trị viên thấy 404). Nhập hàng loạt (`features/admin/bulkImport.ts`) dùng lại api Sáng tác; truyện có bút danh `authorName` (`stories.author_name`, hiển thị thay tên tài khoản; "cùng tác giả" = cùng chủ + cùng bút danh). Truyện bị gỡ (`takedown`) tác giả không tự công khai lại được. Quản trị viên = `User.isAdmin` (Supabase: `app_metadata.role = 'admin'`, cách cấp ở mục 10 `thiet-ke-database.md`; bản giả: tài khoản demo). Chỉ khu này dùng **Ant Design** + `@ant-design/plots` (lazy chunk riêng); style antd không nằm trong `@layer` nên thắng class Tailwind cùng thuộc tính. Test thay `@ant-design/plots` bằng `vi.mock` (G2 cần canvas). Kho người dùng giả chung với auth ở `src/mocks/users.ts`. Truyện chọn tay cho trang chủ (`/admin/featured`, bảng `curated_stories`, bản giả `src/mocks/curated.ts`): danh sách trống thì trang chủ tự chọn. Select nhiều lựa chọn của antd dùng danh sách ảo (jsdom không vẽ option): danh sách ngắn thì đặt `virtual={false}`. Plan: `documents/plan-trang-quan-tri.md`, `documents/plan-cong-cu-admin.md`.
- **Bình luận** (`features/comments`, plan `documents/plan-tra-loi-va-kiem-duyet-binh-luan.md`): trả lời chỉ một cấp (`Comment.parentId`); `getComments` chỉ trả bình luận gốc kèm `replyCount`, trả lời tải riêng bằng `getReplies` khi mở nhóm. Trả lời một câu trả lời vẫn gắn vào bình luận gốc, ô nhập điền sẵn `@Tên `. Người đọc báo cáo bình luận của người khác (`reportComment`); quản trị viên xử lý ở `/admin/comments` (xóa hoặc bỏ qua). Bản giả xóa bình luận ở mọi nơi qua `removeComments()` của `mocks/activity.ts` để trả lời và báo cáo mất theo; bình luận mẫu không báo cáo được.
- **Thể loại**: `features/genres` (`useGenres`, `createGenre`); chống trùng bằng `slugify` (`src/lib/slugify.ts`, bỏ dấu, `đ` → `d`; tên có slug rỗng bị form chặn). Bản Supabase đọc `genre_cards`, trùng (`23505`) thì ném `GenreExistsError`.
- **Tìm kiếm & danh sách:**
  - `searchStories` (không dấu, qua `slugify`) cho trang `/search` và gợi ý nhanh trong `SearchBox` (combobox ARIA).
  - `browseStories` + `StoryBrowser` (bộ lọc trên URL, `browseParams.ts`) cho `/list/:type` và `/genres/:slug`.
  - `getRanking` cho `/ranking` và "Top tuần".
  - Phân trang dùng chung `components/common/Pagination`; nhóm tab dạng link dùng `SegmentedLinks`; trang thông tin dùng khung `InfoPage`.
- **Trang chi tiết truyện** (`/story/:slug`): trang và thứ tự danh sách chương nằm trên URL (`?page=`, `?sort=newest`); các `Link` đổi trang dùng `preventScrollReset`. Thanh mục lục dính dùng `useActiveSection` (IntersectionObserver). Plan chi tiết: `documents/plan-trang-chi-tiet-truyen.md`.
- **Trang đọc** (`/story/:slug/chapter-:n`):
  - **Route:** khai báo là `truyen/:slug/:chapter` (router không nhận tham số giữa đoạn) và `ChapterReaderPage` tự tách số.
  - **Dữ liệu:** lấy qua `getChapter` → kiểu `ChapterContent`. Chương trước/sau tính theo thứ tự chương đã xuất bản, không phải ±1.
  - **Cài đặt đọc:** `features/reader/useReaderSettings` (Zustand key `reader-settings`, gồm `continuous`).
  - **Màu nền:** các class `reader-tone-*` trong `src/index.css`, ghi đè token màu trong vùng đọc. Sheet render qua portal nên vẫn theo theme của web.
  - **Font đọc có chân:** `font-reading` (Literata).
  - **Mốc DOM:** mỗi chương là `<article data-chapter>`, mỗi đơn vị đọc (đoạn, tiêu đề, mục danh sách) có `data-paragraph` đánh số liên tục. Tiến độ, lưu vị trí và giọng đọc đều dựa vào hai mốc này (`features/reader/progress.ts`); giọng đọc lấy chữ bằng `blockTexts(parseContent(...))` theo đúng thứ tự đó.
  - **Hai chế độ:** từng chương, hoặc cuộn liên tục (`ChapterStream`: nối chương sau và đổi URL theo chương đang đọc, dùng `replace` + `state: { stream: true }`). Điều hướng không có `stream` thì chuỗi chương bắt đầu lại.
  - **Nghe truyện:** `features/reader/speech` (Web Speech API, Zustand key `reader-speech`). Giọng đọc tự chuyển chương thì điều hướng kèm `state: { speech: true }`. Người đọc tự chuyển chương khác thì dừng đọc.
  - **Tự động cuộn:** `features/reader/autoscroll` (Zustand key `reader-autoscroll`; 1× = 220 chữ/phút, đo theo bố cục thật). Không chạy cùng nghe truyện. Trong lúc tự cuộn, thanh công cụ chỉ ẩn/hiện khi chạm chữ (`useAutoHideToolbar(frozen)`). Hết chương thì dừng, nút "Chương sau" trên thanh nổi sang chương và cuộn tiếp; tự chuyển chương cách khác thì tạm dừng. Cuộn liên tục thì chờ ở đáy trang tới khi chương sau nối vào (`[data-stream-end]` đánh dấu hết chuỗi). Hai thanh nổi dùng chung `FloatingBar`.
  - **Lịch sử và lượt đọc:** ghi bằng `useReadingTracker` + `useRecordChapterView` (không tính lượt của chính tác giả).
  - **Cuối chương:** có "Báo lỗi chương" (`features/feedback`) và bình luận của chương (`CommentsSection` với prop `chapter`).
- **Đọc offline & PWA** (`features/offline`, plan `documents/plan-pwa-doc-offline.md`):
  - `vite-plugin-pwa` cấu hình ở `pwa.config.ts` (precache bỏ chunk khu Quản trị/Sáng tác và font `cyrillic`/`greek`, phải giữ `latin-ext` vì bộ này chứa cả Đ, Ơ, Ư...; tắt ở dev và test). Icon sinh từ `public/favicon.svg` bằng `npm run generate-pwa-assets`. Có bản mới thì hỏi (`src/app/PwaUpdater.tsx`).
  - Chương đọc qua `readChapter` → kho IndexedDB `features/offline/store.ts` (có bản lưu thì trả ngay và làm mới ở nền; mất mạng mà chưa lưu → `ChapterNotSavedError`). Tải trước 5 chương (`usePrefetchChapters`), tải về chủ động thì ghim (`downloads.ts`), tối đa 300 chương không ghim. Chỉ lưu chương của truyện công khai (`isSavable`). Tab `/library?tab=saved`.
  - Query/mutation cần chạy khi offline đặt `networkMode: 'always'` (chương, kho, phiên đăng nhập, ghi lịch sử).
  - Lịch sử đọc lỗi mạng (bản Supabase) vào hàng chờ `features/library/pendingProgress.ts`, `OfflineSync` gửi khi có mạng lại.
  - Thông báo nổi dùng `toast` của `sonner`.
- **Cuộn trang**: layout dùng `AppScrollRestoration` thay vì `ScrollRestoration` trực tiếp (lý do ghi trong file).
- **Chống spam & xóa tài khoản**: trigger DB giới hạn tần suất bình luận, liên hệ, báo lỗi, báo cáo bình luận, tạo thể loại và chỉ tính 1 lượt đọc / người / chương / ngày; vượt giới hạn ném `rate_limited` (bình luận trùng: `duplicate_comment`), api remote đổi sang `AuthError` bằng `limitError()`; bản giả làm cùng mức (`src/mocks/rateLimit.ts`). Tác giả có hạn mức mỗi ngày (truyện mới, chương mới, dung lượng nội dung ghi kể cả khi sửa: `story_limit`/`chapter_limit` → `StudioError`) và hạn mức ảnh tải lên (`ImageLimitError`); quản trị viên không bị giới hạn. Captcha Cloudflare Turnstile (`features/auth/useCaptcha.tsx`, bật bằng `VITE_TURNSTILE_SITE_KEY`) cho các form gọi Supabase Auth bằng email + mật khẩu; bản giả và test không có captcha. Mức giới hạn ở mục 4 `thiet-ke-database.md`. Tự xóa tài khoản ở cuối trang `/account` (`deleteAccount`: remote xóa ảnh Storage rồi `rpc('delete_account')`, DB cascade; bản giả `src/mocks/accounts.ts`).
- **Form**: react-hook-form + zod (`mode: 'onTouched'`), schema và thông báo lỗi tiếng Việt ở `features/auth/schemas.ts`. Dùng `FormField` (render-prop truyền `id`/`aria-invalid`/`aria-describedby` cho ô nhập) để giữ đúng liên kết nhãn–lỗi.
- **Feature-based**: `src/features/<feature>/` (stories, chapters, reader, auth, library, comments, genres, studio, feedback, admin) chứa component + hooks + `api.ts` của feature đó. `src/components/ui/` là code shadcn sinh ra; `src/components/common/` là component dùng chung tự viết.
- **Quy tắc dữ liệu (quan trọng)**: component không bao giờ gọi Supabase hay đọc `src/mocks/` trực tiếp. Mọi lấy/ghi dữ liệu đi qua `features/<x>/api.ts`, bọc bằng hook TanStack Query.
  - Mỗi feature tách 4 file: `api.ts` (chọn backend: `const api: typeof mock = supabase ? remote : mock`, export lại mọi hàm và `export * from './shared'`), `api.mock.ts` (chỉ export hàm backend), `api.remote.ts` (cùng tên và chữ ký hàm, không import `@/mocks/*`), `shared.ts` (kiểu, hằng, lớp lỗi, hàm thuần).
  - Tiện ích cho bản remote: `src/lib/dbError.ts` (`unwrap`, `businessCode`...), `src/lib/dbPage.ts` (`loadPage`: phân trang có đếm tổng, kẹp trang như `paginate()`), `src/lib/uuid.ts` (`isUuid`), `requireUserId()` của auth api, thẻ truyện ở `features/stories/cards.remote.ts`. Bảng tra hàm → bảng/RPC ở mục 8 `documents/thiet-ke-database.md`.
  - DB thật bắt đầu trống (không có truyện hay thể loại có sẵn): UI phải có trạng thái rỗng, không giả định truyện "hệ thống", tài khoản demo hay chương bắt đầu từ 1.
- **State client**: Zustand (+ persist localStorage) cho cài đặt đọc (font, cỡ chữ, màu nền, theme). Dữ liệu server luôn ở TanStack Query, không đưa vào Zustand.
- **Supabase client**: `src/lib/supabase.ts` export `supabase` (kiểu `Database` sinh ở `src/types/database.ts`) có thể là `null` khi chưa cấu hình `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — cần xử lý trường hợp này.
- **Database** (project `zsbyjxaaxtylgmxybzpf`, CLI đã `link`). Thiết kế và bảng tra "hàm api.ts → bảng/RPC" ở `documents/thiet-ke-database.md`; `api.ts` vẫn chạy mock cho tới khi nối từng feature.
  - **Migration:** tạo bằng `supabase migration new <ten>` (không tự đặt tên file), rồi `supabase db push --dry-run` → `supabase db push` → `supabase db advisors --linked`.
  - **Sau khi đổi schema:** sinh lại kiểu bằng `supabase gen types typescript --linked --schema public > src/types/database.ts` (file sinh ra, không format bằng prettier). Chạy `supabase db query --linked -f supabase/checks/rls_and_rules.sql` (chạy trong transaction rồi rollback, không lỗi = qua) và thêm ca kiểm tra mới vào file này. DB thật đã có dữ liệu nên ca kiểm tra không đếm trên cả bảng; cách thử migration trước khi push ở mục 9 `thiet-ke-database.md`.
  - **Quyền:** bảng mới luôn `revoke all … from anon, authenticated` rồi `grant` đúng quyền, vì Supabase không còn tự mở bảng ra Data API và grant theo cột chỉ có tác dụng khi không có quyền mức bảng. Policy dùng `(select auth.uid())` và ghi rõ `to anon`/`to authenticated`.
  - **Hàm:** hàm `security definer` để ở schema `private` với `set search_path = ''`. Khách cũng cần gọi thì làm lớp vỏ `security invoker` ở `public` gọi sang (như `record_chapter_view`). `supabase db advisors` không được còn cảnh báo mức WARN.
  - **Luật nghiệp vụ** nằm ở trigger, ném lỗi có mã trong `error.message` (`no_published_chapters`, `last_published_chapter`, `chapter_number_locked`, `too_many_genres`, `not_found`, `unauthenticated`); trùng số chương/thể loại là `23505`.
  - **Số liệu:** `story_stats` do trigger/RPC ghi, client chỉ đọc. Danh sách công khai lấy từ view `story_cards`, lọc `visibility = 'published'` và `chapter_count > 0`.
- **SEO** (plan `documents/plan-seo-va-xem-truoc-link.md`):
  - Trang công khai dùng `<Seo {...}>` (`components/common/Seo`: title, description, canonical, Open Graph; thẻ native của React 19, không dùng react-helmet). Trang riêng tư, tìm kiếm, 404 đặt `noindex` (`<Seo noindex>` hoặc `<NoIndex />` ở khung của cả khu).
  - Thẻ dựng từ `src/lib/seo.ts` (`storySeo`, `chapterSeo`, `genreSeo`, `seoTags`), dùng chung với hàm Vercel. File này, `src/lib/routes.ts` và `src/config/site.ts` không được dùng alias `@/` hay `import.meta`, và import tương đối ghi đuôi `.js`.
  - Bot không chạy JS (Facebook, Zalo, Telegram, Google...) được `vercel.json` chuyển theo user-agent sang hàm `api/meta.ts`: trả `index.html` đã chèn thẻ của trang, 404 cho truyện/chương/thể loại không có. Logic ở `api/_lib/` (thư mục bắt đầu bằng `_` không thành hàm); import trong `api/` phải ghi đuôi `.js`. Thêm trang công khai mới thì khai báo ở `matchRoute` (`api/_lib/html.ts`); trang tĩnh thì thêm vào `STATIC_PAGES` của `src/lib/seo.ts` (trang lấy tiêu đề, mô tả từ đó để thẻ của app và của hàm giống hệt nhau).
  - `/sitemap.xml` do `api/sitemap.ts` sinh; `robots.txt` và thẻ mặc định trong `index.html` (`data-seo="default"`, app gỡ khi khởi động) do plugin `seo.config.ts` sinh lúc build.
  - Địa chỉ web: `DEFAULT_SITE_URL` (`src/config/site.ts`), ghi đè bằng `VITE_SITE_URL`; client đọc qua `SITE_URL` (`src/lib/siteUrl.ts`). Ảnh xem trước mặc định `public/og-default.png` có tên web: đổi `SITE_NAME` thì làm lại ảnh.
  - Rewrite có `has` không chạy với `vercel dev`: thử trên bản deploy bằng `vercel deploy` rồi `vercel curl <đường dẫn> --deployment <url> -- -A "facebookexternalhit/1.1"` (bản preview có lớp đăng nhập nên hàm trả trang tối giản thay vì `index.html`).

## Quy ước

- Tên nhánh git đặt bằng tiếng Anh (kebab-case). Chữ trên giao diện, tài liệu và commit message vẫn bằng tiếng Việt.
- Import alias `@/` → `src/` (cấu hình ở cả `vite.config.ts` và `tsconfig*.json`).
- Mọi URL lấy từ `paths` trong `src/lib/routes.ts`, không viết cứng. Tên web lấy từ `SITE_NAME` (`src/config/site.ts`).
- Hệ thiết kế (màu, font, bố cục trang chủ) ghi ở mục 8 của file plan. Token màu riêng: `rose-gold`, `neon`, `wine`; font: `font-script` (logo), `font-heading` (serif), `font-sans`. Mặc định giao diện tối; theme lưu ở Zustand key `theme`, script inline trong `index.html` đọc key này để tránh nháy màu.
- Không bọc `NavLink` bằng component Radix `asChild` (vd `SheetClose`): Slot ghép className sẽ phá className dạng hàm của NavLink.
- Phần tử `absolute` (kể cả `sr-only`) nằm trong vùng cuộn ngang phải có tổ tiên `relative` bên trong vùng cuộn, nếu không sẽ thoát ra và gây cuộn ngang cả trang.
- Nội dung người dùng không bao giờ render HTML thô. Bình luận là văn bản thuần (`whitespace-pre-line`). Nội dung chương là HTML rút gọn của trình soạn hoặc văn bản thuần kiểu cũ (chương cũ, nhập `.txt`); mọi chỗ đọc chương đi qua `features/chapters/richText.ts` (`parseContent` lọc ra mô hình khối, trang đọc dựng bằng React; `contentText` để đếm chữ; schema lưu `normalizeContent`). Giới hạn 100.000 ký tự tính trên chữ nhìn thấy, DB cho bản lưu tới 200.000.
- **Test tích hợp:**
  - Dùng `renderApp(path)` ở `src/test/renderApp.tsx` (QueryClient + memory router mới cho mỗi test, trả về `user` của user-event).
  - Tiện ích đăng nhập, tạo người dùng, đăng truyện ở `src/test/helpers.ts`.
  - Test auth gọi `localStorage.clear()` trong `beforeEach`.
  - Mock có độ trễ nên `findBy*` cần `{ timeout: 3000 }`; `testTimeout` chung là 10 giây.
  - Điều hướng tới trang lazy-load và dữ liệu ghi sau cập nhật lạc quan cần `expect.poll(...)` thay vì kiểm tra ngay sau `user.click`.
  - `src/test/setup.ts` đã stub các API jsdom thiếu cho Radix và ProseMirror. Gõ từng phím vào trình soạn chương bị mất ký tự trong jsdom: dùng `writeInEditor` (bấm rồi dán) ở `src/test/helpers.ts`. jsdom không có `speechSynthesis`/`IntersectionObserver`: test nghe truyện dùng `vi.stubGlobal`, còn cuộn liên tục thì bấm nút "Tải chương N". Test tự động cuộn giả `requestAnimationFrame`/`scrollTo` và `getBoundingClientRect` (xem `features/reader/autoscroll.test.tsx`).
  - Đọc offline: `fake-indexeddb` nạp trong `src/test/setup.ts` (mỗi test một kho trống, hết test tự có mạng lại). Giả mất mạng bằng `goOffline()`, chương giả bằng `fakeChapter()` ở `src/test/offline.ts`.
- Kiểm tra UI ở 375px, 768px, 1440px và cả hai theme; ảnh chụp Playwright để trong `.playwright-mcp/` (đã gitignore).
- Tailwind v4 không có `tailwind.config`; theme/token (màu, font Geist, dark mode qua class `.dark`) nằm trong `src/index.css`. Dùng các class token của shadcn (`bg-background`, `text-muted-foreground`...) thay vì màu cứng.
- `cn()` ở `src/lib/utils.ts` re-export từ package `cn` (của shadcn, thay cho clsx + tailwind-merge).
- Prettier: không dấu chấm phẩy, nháy đơn, `printWidth` 100.
- Rule `react/only-export-components` đã tắt riêng cho `src/components/ui/**`.
- `SelectTrigger` của shadcn có sẵn `data-[size=default]:h-8`, class này đè lên `h-*` thường. Muốn đổi chiều cao thì dùng `data-[size=default]:h-10` (tương tự với các chiều cao khác).
- Biểu đồ (thống kê Sáng tác) dùng token `bg-chart-1`, màu đã kiểm bằng validator của skill dataviz ở cả hai theme.
- Biến env không có tiền tố `VITE_` (HOST, PORT) chỉ dùng trong `vite.config.ts`, không lộ ra client. `.gitignore` chặn mọi `.env*`; riêng `.env.example` (file mẫu) đã được track nên sửa vẫn commit bình thường.
- **Header bảo mật** (CSP, chống nhúng iframe...) ở `vercel.json`. CSP viết cứng host Supabase (`connect-src`) và hash của script inline trong `index.html`: sửa script đó thì cập nhật hash (test `src/app/securityHeaders.test.ts` báo sai); thêm tài nguyên ngoài (script, iframe, API) thì thêm vào CSP. Đổi project Supabase thì sửa cả host trong CSP và URL ảnh đại diện trong trigger `profiles_check_avatar`.
- Deploy: Vercel (project `toanco123s-projects/web-novel-platform`) nối repo GitHub: push `main` → production https://web-novel-platform-gules.vercel.app, nhánh khác → bản preview (phải đăng nhập Vercel mới xem được). `vercel.json` chuyển mọi đường dẫn về `index.html` (SPA) và cache lâu `/assets/*`. Biến `VITE_*` (vd Supabase) phải khai báo ở Vercel → Settings → Environment Variables vì `.env` không lên git.
