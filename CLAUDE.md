# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tổng quan

Web đọc **truyện chữ** (kiểu TruyenFull/Wattpad), dạng SPA: Vite + React 19 + TypeScript + Tailwind CSS v4, backend dự kiến là **Supabase**. Hiện đang ở giai đoạn **làm UI với dữ liệu giả (mock)**; Supabase nối sau.

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
```

## Kiến trúc

- **Entry**: `src/main.tsx` → `Providers` (`src/app/providers.tsx`: TanStack Query + TooltipProvider) → `RouterProvider` (import từ `react-router/dom`).
- **Routing**: React Router **v8**, data mode, khai báo tập trung ở `src/app/router.tsx` (mảng `routes` được export để test dùng lại). Mỗi trang lazy-load qua helper `page(() => import(...))`, nên file trong `src/pages/` dùng `export default`. Mỗi layout gốc có `HydrateFallback: PageLoader` — bỏ đi sẽ gây warning. URL dùng tiếng Việt không dấu (`/truyen/:slug`, `/truyen/:slug/chuong-:number`, `/the-loai/:slug`, `/tim-kiem`, `/tu-truyen`, `/dang-nhap`...).
- **Layouts**: `MainLayout` (header + footer) cho trang thường; `AuthLayout` (panel bìa truyện + form, không header/footer) cho đăng nhập/đăng ký/quên & đặt lại mật khẩu; `ReaderLayout` (không header/footer, áp màu nền theo cài đặt đọc) cho trang đọc chương.
- **Auth**: phiên đăng nhập nằm trong TanStack Query (`useSession`, key `['auth', 'session']`); các mutation trong `features/auth/hooks.ts` cập nhật cache bằng `setQueryData`. `features/auth/api.ts` hiện là auth giả lưu `localStorage` (`mock-auth-users`, `mock-auth-session`; tài khoản demo `demo@webtruyen.vn` / `matkhau123`). Chuyển hướng sau đăng nhập dùng `?next=` và luôn đi qua `safeNext()` (chống open redirect); tạo link bằng `paths.login(next)` / `paths.register(next)`. Cách ánh xạ sang Supabase ghi ở mục 6 `documents/plan-dang-nhap-dang-ky.md`.
- **Dữ liệu giả có ghi**: lưu `localStorage` qua `readMock`/`writeMock` (`src/lib/mockStorage.ts`). Dữ liệu hoạt động của người đọc mà nhiều api cùng dùng (theo dõi, lịch sử đọc, lượt đọc, chấm điểm, bình luận, báo lỗi) gom ở `src/mocks/activity.ts`: api này không đọc thẳng key localStorage của api khác. Thao tác cần đăng nhập gọi `requireUser()` của auth api (ném `AuthError` mã `unauthenticated`). Query key có dữ liệu riêng từng người luôn chứa `userId` (khách dùng `'guest'`) để đổi tài khoản không lẫn cache. Dữ liệu giả sinh cố định theo slug bằng `seededRandom` (`src/lib/seededRandom.ts`).
- **Tủ truyện & lịch sử đọc** (`features/library`, trang `/tu-truyen?muc=theo-doi|lich-su`):
  - Theo dõi lưu mốc `seenChapter`; số chương mới = chương xuất bản sau mốc (hiện ở tủ truyện và chấm trên avatar).
  - Lịch sử đọc có cả cho khách (lưu dưới khóa `guest`, gộp vào tài khoản ở lần đầu đăng nhập).
  - Link "Đọc tiếp" truyền `state` từ `resumeState()` để trang đọc cuộn tới chỗ đọc dở.
- **Danh mục giả**: `src/mocks/catalog.ts` gộp truyện có sẵn với truyện người dùng (`src/mocks/userContent.ts`, localStorage); mọi api đọc truyện/chương/thể loại phải lấy qua `catalog()`/`findStory()`/`readerChapters()`, không đọc thẳng `mocks/stories.ts`. Truyện nháp chỉ hiện với chủ truyện; danh sách công khai chỉ lấy truyện có ≥ 1 chương đã xuất bản. `Story.latestChapter`/`firstChapterNumber` có thể `null`, và `ratingCount` có thể bằng 0.
- **Sáng tác** (`/sang-tac/*`, bọc `RequireAuth` qua `pages/studio/StudioShell`): api ở `features/studio/api.ts`, mọi hàm kiểm tra chủ truyện (truyện của người khác → `not_found`). Trang quản lý truyện có tab Thống kê (`getStoryStats`) và Báo lỗi (`getStoryReports`/`setReportStatus`). Quy tắc: truyện chỉ xuất bản khi có ≥ 1 chương đã xuất bản; truyện đang công khai không được ẩn/xóa chương công khai cuối cùng. Mutation của studio invalidate cả key công khai (`['stories']`, `['chapters']`, `['genres']`). Dữ liệu lớn ghi bằng `writeMockStrict` (ném `StorageFullError` khi localStorage đầy). Lỗi hiển thị qua `studioErrorMessage`. Plan: `documents/plan-sang-tac-va-the-loai.md`.
- **Thể loại**: `features/genres` (`useGenres`, `createGenre`); chống trùng bằng `slugify` (`src/lib/slugify.ts`, bỏ dấu, `đ` → `d`).
- **Tìm kiếm & danh sách:**
  - `searchStories` (không dấu, qua `slugify`) cho trang `/tim-kiem` và gợi ý nhanh trong `SearchBox` (combobox ARIA).
  - `browseStories` + `StoryBrowser` (bộ lọc trên URL, `browseParams.ts`) cho `/danh-sach/:type` và `/the-loai/:slug`.
  - `getRanking` cho `/bang-xep-hang` và "Top tuần".
  - Phân trang dùng chung `components/common/Pagination`; nhóm tab dạng link dùng `SegmentedLinks`; trang thông tin dùng khung `InfoPage`.
- **Trang chi tiết truyện** (`/truyen/:slug`): trang và thứ tự danh sách chương nằm trên URL (`?trang=`, `?sap-xep=moi`); các `Link` đổi trang dùng `preventScrollReset`. Thanh mục lục dính dùng `useActiveSection` (IntersectionObserver). Plan chi tiết: `documents/plan-trang-chi-tiet-truyen.md`.
- **Trang đọc** (`/truyen/:slug/chuong-:n`):
  - **Route:** khai báo là `truyen/:slug/:chapter` (router không nhận tham số giữa đoạn) và `ChapterReaderPage` tự tách số.
  - **Dữ liệu:** lấy qua `getChapter` → kiểu `ChapterContent`. Chương trước/sau tính theo thứ tự chương đã xuất bản, không phải ±1.
  - **Cài đặt đọc:** `features/reader/useReaderSettings` (Zustand key `reader-settings`, gồm `continuous`).
  - **Màu nền:** các class `reader-tone-*` trong `src/index.css`, ghi đè token màu trong vùng đọc. Sheet render qua portal nên vẫn theo theme của web.
  - **Font đọc có chân:** `font-reading` (Literata).
  - **Mốc DOM:** mỗi chương là `<article data-chapter>`, mỗi đoạn là `<p data-paragraph>`. Tiến độ, lưu vị trí và giọng đọc đều dựa vào hai mốc này (`features/reader/progress.ts`).
  - **Hai chế độ:** từng chương, hoặc cuộn liên tục (`ChapterStream`: nối chương sau và đổi URL theo chương đang đọc, dùng `replace` + `state: { stream: true }`). Điều hướng không có `stream` thì chuỗi chương bắt đầu lại.
  - **Nghe truyện:** `features/reader/speech` (Web Speech API, Zustand key `reader-speech`). Giọng đọc tự chuyển chương thì điều hướng kèm `state: { speech: true }`. Người đọc tự chuyển chương khác thì dừng đọc.
  - **Lịch sử và lượt đọc:** ghi bằng `useReadingTracker` + `useRecordChapterView` (không tính lượt của chính tác giả).
  - **Cuối chương:** có "Báo lỗi chương" (`features/feedback`) và bình luận của chương (`CommentsSection` với prop `chapter`).
- **Cuộn trang**: layout dùng `AppScrollRestoration` thay vì `ScrollRestoration` trực tiếp (lý do ghi trong file).
- **Form**: react-hook-form + zod (`mode: 'onTouched'`), schema và thông báo lỗi tiếng Việt ở `features/auth/schemas.ts`. Dùng `FormField` (render-prop truyền `id`/`aria-invalid`/`aria-describedby` cho ô nhập) để giữ đúng liên kết nhãn–lỗi.
- **Feature-based**: `src/features/<feature>/` (stories, chapters, reader, auth, library, comments, genres, studio, feedback) chứa component + hooks + `api.ts` của feature đó. `src/components/ui/` là code shadcn sinh ra; `src/components/common/` là component dùng chung tự viết.
- **Quy tắc dữ liệu (quan trọng)**: component không bao giờ gọi Supabase hay đọc `src/mocks/` trực tiếp. Mọi lấy/ghi dữ liệu đi qua `features/<x>/api.ts`, bọc bằng hook TanStack Query. Giai đoạn UI `api.ts` trả mock; khi nối backend chỉ thay ruột `api.ts`.
- **State client**: Zustand (+ persist localStorage) cho cài đặt đọc (font, cỡ chữ, màu nền, theme). Dữ liệu server luôn ở TanStack Query, không đưa vào Zustand.
- **Supabase client**: `src/lib/supabase.ts` export `supabase` có thể là `null` khi chưa cấu hình `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — cần xử lý trường hợp này. Migration SQL để ở `supabase/migrations/`.
- **SEO**: dùng thẻ `<title>`/`<meta>` native của React 19 đặt thẳng trong component trang (không dùng react-helmet).

## Quy ước

- Import alias `@/` → `src/` (cấu hình ở cả `vite.config.ts` và `tsconfig*.json`).
- Mọi URL lấy từ `paths` trong `src/lib/routes.ts`, không viết cứng. Tên web lấy từ `SITE_NAME` (`src/config/site.ts`).
- Hệ thiết kế (màu, font, bố cục trang chủ) ghi ở mục 8 của file plan. Token màu riêng: `rose-gold`, `neon`, `wine`; font: `font-script` (logo), `font-heading` (serif), `font-sans`. Mặc định giao diện tối; theme lưu ở Zustand key `theme`, script inline trong `index.html` đọc key này để tránh nháy màu.
- Không bọc `NavLink` bằng component Radix `asChild` (vd `SheetClose`): Slot ghép className sẽ phá className dạng hàm của NavLink.
- Phần tử `absolute` (kể cả `sr-only`) nằm trong vùng cuộn ngang phải có tổ tiên `relative` bên trong vùng cuộn, nếu không sẽ thoát ra và gây cuộn ngang cả trang.
- Nội dung người dùng (chương, bình luận) luôn hiển thị dạng văn bản thuần (`whitespace-pre-line`), không render HTML.
- **Test tích hợp:**
  - Dùng `renderApp(path)` ở `src/test/renderApp.tsx` (QueryClient + memory router mới cho mỗi test, trả về `user` của user-event).
  - Tiện ích đăng nhập, tạo người dùng, đăng truyện ở `src/test/helpers.ts`.
  - Test auth gọi `localStorage.clear()` trong `beforeEach`.
  - Mock có độ trễ nên `findBy*` cần `{ timeout: 3000 }`; `testTimeout` chung là 10 giây.
  - Điều hướng tới trang lazy-load và dữ liệu ghi sau cập nhật lạc quan cần `expect.poll(...)` thay vì kiểm tra ngay sau `user.click`.
  - `src/test/setup.ts` đã stub các API jsdom thiếu cho Radix. jsdom không có `speechSynthesis`/`IntersectionObserver`: test nghe truyện dùng `vi.stubGlobal`, còn cuộn liên tục thì bấm nút "Tải chương N".
- Kiểm tra UI ở 375px, 768px, 1440px và cả hai theme; ảnh chụp Playwright để trong `.playwright-mcp/` (đã gitignore).
- Tailwind v4 không có `tailwind.config`; theme/token (màu, font Geist, dark mode qua class `.dark`) nằm trong `src/index.css`. Dùng các class token của shadcn (`bg-background`, `text-muted-foreground`...) thay vì màu cứng.
- `cn()` ở `src/lib/utils.ts` re-export từ package `cn` (của shadcn, thay cho clsx + tailwind-merge).
- Prettier: không dấu chấm phẩy, nháy đơn, `printWidth` 100.
- Rule `react/only-export-components` đã tắt riêng cho `src/components/ui/**`.
- `SelectTrigger` của shadcn có sẵn `data-[size=default]:h-8`, class này đè lên `h-*` thường. Muốn đổi chiều cao thì dùng `data-[size=default]:h-10` (tương tự với các chiều cao khác).
- Biểu đồ (thống kê Sáng tác) dùng token `bg-chart-1`, màu đã kiểm bằng validator của skill dataviz ở cả hai theme.
- Biến env không có tiền tố `VITE_` (HOST, PORT) chỉ dùng trong `vite.config.ts`, không lộ ra client. `.gitignore` chặn mọi `.env*`; riêng `.env.example` (file mẫu) đã được track nên sửa vẫn commit bình thường.
- Deploy: Vercel (project `toanco123s-projects/web-novel-platform`) nối repo GitHub: push `main` → production https://web-novel-platform-gules.vercel.app, nhánh khác → bản preview (phải đăng nhập Vercel mới xem được). `vercel.json` chuyển mọi đường dẫn về `index.html` (SPA) và cache lâu `/assets/*`. Biến `VITE_*` (vd Supabase) phải khai báo ở Vercel → Settings → Environment Variables vì `.env` không lên git.
