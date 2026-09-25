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
- **Dữ liệu giả có ghi**: tủ truyện (`features/library`), bình luận & chấm điểm (`features/comments`) lưu `localStorage` qua `readMock`/`writeMock` (`src/lib/mockStorage.ts`); thao tác cần đăng nhập gọi `requireUser()` của auth api (ném `AuthError` mã `unauthenticated`). Query key có dữ liệu riêng từng người luôn chứa `userId` để đổi tài khoản không lẫn cache. Dữ liệu giả sinh cố định theo slug bằng `seededRandom` (`src/lib/seededRandom.ts`).
- **Danh mục giả**: `src/mocks/catalog.ts` gộp truyện có sẵn với truyện người dùng (`src/mocks/userContent.ts`, localStorage); mọi api đọc truyện/chương/thể loại phải lấy qua `catalog()`/`findStory()`/`readerChapters()`, không đọc thẳng `mocks/stories.ts`. Truyện nháp chỉ hiện với chủ truyện; danh sách công khai chỉ lấy truyện có ≥ 1 chương đã xuất bản. `Story.latestChapter`/`firstChapterNumber` có thể `null`, và `ratingCount` có thể bằng 0.
- **Sáng tác** (`/sang-tac/*`, bọc `RequireAuth` qua `pages/studio/StudioShell`): api ở `features/studio/api.ts`, mọi hàm kiểm tra chủ truyện (truyện của người khác → `not_found`). Quy tắc: truyện chỉ xuất bản khi có ≥ 1 chương đã xuất bản; truyện đang công khai không được ẩn/xóa chương công khai cuối cùng. Mutation của studio invalidate cả key công khai (`['stories']`, `['chapters']`, `['genres']`). Dữ liệu lớn ghi bằng `writeMockStrict` (ném `StorageFullError` khi localStorage đầy). Lỗi hiển thị qua `studioErrorMessage`. Plan: `documents/plan-sang-tac-va-the-loai.md`.
- **Thể loại**: `features/genres` (`useGenres`, `createGenre`); chống trùng bằng `slugify` (`src/lib/slugify.ts`, bỏ dấu, `đ` → `d`).
- **Trang chi tiết truyện** (`/truyen/:slug`): trang và thứ tự danh sách chương nằm trên URL (`?trang=`, `?sap-xep=moi`); các `Link` đổi trang dùng `preventScrollReset`. Thanh mục lục dính dùng `useActiveSection` (IntersectionObserver). Plan chi tiết: `documents/plan-trang-chi-tiet-truyen.md`.
- **Trang đọc** (`/truyen/:slug/chuong-:n`): route khai báo là `truyen/:slug/:chapter` (router không nhận tham số giữa đoạn) và `ChapterReaderPage` tự tách số. Dữ liệu lấy qua `getChapter` → kiểu `ChapterContent`; chương trước/sau tính theo thứ tự chương đã xuất bản, không phải ±1. Cài đặt đọc ở `features/reader/useReaderSettings` (Zustand key `reader-settings`). Màu nền trang đọc là các class `reader-tone-*` trong `src/index.css`, ghi đè token màu trong vùng đọc; Sheet render qua portal nên vẫn theo theme của web. Font đọc có chân: `font-reading` (Literata).
- **Cuộn trang**: layout dùng `AppScrollRestoration` thay vì `ScrollRestoration` trực tiếp (lý do ghi trong file).
- **Form**: react-hook-form + zod (`mode: 'onTouched'`), schema và thông báo lỗi tiếng Việt ở `features/auth/schemas.ts`. Dùng `FormField` (render-prop truyền `id`/`aria-invalid`/`aria-describedby` cho ô nhập) để giữ đúng liên kết nhãn–lỗi.
- **Feature-based**: `src/features/<feature>/` (stories, chapters, reader, auth, library, comments) chứa component + hooks + `api.ts` của feature đó. `src/components/ui/` là code shadcn sinh ra; `src/components/common/` là component dùng chung tự viết.
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
- Test tích hợp dùng `renderApp(path)` ở `src/test/renderApp.tsx` (QueryClient + memory router mới cho mỗi test, trả về `user` của user-event). Test auth gọi `localStorage.clear()` trong `beforeEach`; mock có độ trễ nên `findBy*` cần `{ timeout: 3000 }`. Điều hướng tới trang lazy-load và dữ liệu ghi sau cập nhật lạc quan cần `expect.poll(...)` thay vì kiểm tra ngay sau `user.click`. `src/test/setup.ts` đã stub các API jsdom thiếu cho Radix.
- Kiểm tra UI ở 375px, 768px, 1440px và cả hai theme; ảnh chụp Playwright để trong `.playwright-mcp/` (đã gitignore).
- Tailwind v4 không có `tailwind.config`; theme/token (màu, font Geist, dark mode qua class `.dark`) nằm trong `src/index.css`. Dùng các class token của shadcn (`bg-background`, `text-muted-foreground`...) thay vì màu cứng.
- `cn()` ở `src/lib/utils.ts` re-export từ package `cn` (của shadcn, thay cho clsx + tailwind-merge).
- Prettier: không dấu chấm phẩy, nháy đơn, `printWidth` 100.
- Rule `react/only-export-components` đã tắt riêng cho `src/components/ui/**`.
- Biến env không có tiền tố `VITE_` (HOST, PORT) chỉ dùng trong `vite.config.ts`, không lộ ra client. `.env` được gitignore; `.env.example` là file mẫu.
