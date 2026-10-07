# Plan: Theo dõi lỗi bằng Sentry (web)

Trạng thái: ✅ code xong (07/10/2026), chờ khai báo biến trên Vercel và thử trên bản preview (bước 4). Nhánh `error-monitoring`.

Khác với plan:
- **Tải Sentry sau khi trang đã hiện.** `@sentry/react` nằm ở `src/lib/sentryClient.ts`, được `monitoring.ts` tải bằng import động khi trình duyệt rảnh (`requestIdleCallback`, tối đa 4 giây). Nạp ngay thì JS lúc mở trang tăng ~31 KB gzip (255 → 286 KB); tải sau thì chỉ còn +1,2 KB, chunk Sentry ~30 KB tải riêng.
  - Lỗi xảy ra trước khi Sentry tải xong được `monitoring.ts` tự bắt (`error`, `unhandledrejection`) và xếp hàng (tối đa 30), gửi khi tải xong, kèm `extra.source = 'before-load'`.
  - Bản build không có DSN thì toàn bộ Sentry bị loại khỏi bundle (hằng `configured` tính lúc build).
- **`dataCollection` thay cho `sendDefaultPii`** (Sentry 11 bỏ `sendDefaultPii`): `{ userInfo: false, cookies: false, httpBodies: [] }`. Header chỉ giữ `User-Agent` để Sentry biết trình duyệt và hệ điều hành.
- **Lỗi render React ngoài router:** `onUncaughtError` gọi `reportError` (qua hàng chờ) thay cho `Sentry.reactErrorHandler()`, vì lúc `createRoot` chạy thì Sentry chưa tải.
- **Lọc lỗi Sentry tự bắt** (`beforeSend`) dùng lỗi gốc `hint.originalException`, để `AuthError('unknown')` vẫn được gửi.
- Logic lọc lỗi và ẩn token tách ra `src/lib/errorFilter.ts` (thuần, không import Sentry, dùng `isNetworkError` của `src/lib/network.ts`) để app di động chép nguyên; test ở `errorFilter.test.ts`.
- `createQueryClient()` nằm ở `src/app/queryClient.ts` (để `providers.tsx` chỉ export component).
- **Đã thử trên trình duyệt** bằng bản build có DSN trỏ về máy chủ giả trên máy: lỗi trước khi tải xong, lỗi `setTimeout`, promise bị bỏ quên, `AuthError('unknown')` đều tới; lỗi nghiệp vụ và lỗi mạng bị bỏ; URL `/reset-password?code=…#access_token=…&refresh_token=…` gửi đi với giá trị `[đã ẩn]`.

## Context

Hiện lỗi xảy ra trên máy người dùng không được ghi lại ở đâu:
- `RouteError` (`components/common/RouteError.tsx`) chỉ hiện màn "Không mở được trang này", không gửi đi đâu và không đọc `useRouteError()`.
- Lỗi tải dữ liệu của TanStack Query hiện tại từng khối, không có chỗ bắt lỗi chung (`QueryCache` / `MutationCache`).
- Lỗi JS ngoài React (sự kiện, `setTimeout`, promise bị bỏ quên) không ai bắt.

Phía máy chủ chỉ có log tự động của Supabase (Dashboard → Logs Explorer) và log hàm Vercel `api/meta`, và không có cảnh báo.

Người dùng đã tạo tài khoản Sentry:
- Org `hanoi-university-of-business-a`, project `web-novel-platform` (nền tảng React), vùng dữ liệu **US**.
- Chỉ bật Error monitoring.
- Cảnh báo email khi có lỗi mới.

## Đã chốt (07/10/2026)

- **Sentry, chỉ bắt lỗi.** Không bật Tracing, Session Replay, Logs, Metrics: không cần lúc này, lại tốn hạn mức miễn phí và đụng đến quyền riêng tư.
- **Chỉ bật trên bản build có Supabase và có DSN** (production và preview của Vercel). Dev, test và bản dữ liệu giả không gửi gì.
- **Chỉ gửi lỗi bất thường.** Lỗi nghiệp vụ dự kiến (sai mật khẩu, `rate_limited`, `story_limit`…) và lỗi do mất mạng không gửi (mục 2).
- **Quyền riêng tư:**
  - `sendDefaultPii: false`.
  - Chỉ gắn **id người dùng**, không gửi email hay tên.
  - Xóa token trong URL trước khi gửi (mục 3).
  - Ghi thêm vào trang `/privacy`.
- **Source map** tải lên Sentry lúc build trên Vercel, rồi xóa khỏi `dist`. Người dùng không tải được source map, còn Sentry vẫn hiện đúng dòng code TypeScript gốc.
- **Release** = version trong `package.json` (mỗi commit tăng một bậc). **Environment** = `VERCEL_ENV` (`production` / `preview`).

Ngoài phạm vi:
- App di động: làm cùng nhánh, plan riêng ở `../mobile-novel-platform/documents/plan-theo-doi-loi.md` (chép `errorFilter.ts`, `ErrorBoundary`, crash native).
- Theo dõi lỗi của Postgres và hàm DB (đã có Logs Explorer của Supabase; Log Drains cần gói trả phí).
- Phân tích hành vi người dùng (PostHog…). Nếu cần đo hiệu quả tính năng điểm danh thì làm plan riêng.

## 1. Cài đặt và khởi tạo

- Gói: `@sentry/react` (dependencies) và `@sentry/vite-plugin` (devDependencies).
- **`src/lib/monitoring.ts`** (file mới), nơi duy nhất import `@sentry/react`:
  - `initMonitoring()`: gọi `Sentry.init` khi `import.meta.env.PROD && !__USE_MOCK__ && VITE_SENTRY_DSN`. Tham số:
    - `dsn`
    - `release: __APP_VERSION__`
    - `environment: __SENTRY_ENV__`
    - `sendDefaultPii: false`
    - `integrations`: chỉ giữ mặc định, không thêm tracing hay replay
    - `beforeSend`, `beforeBreadcrumb` (mục 3)
    - `ignoreErrors` cho lỗi do tiện ích trình duyệt (`ResizeObserver loop…` và các lỗi tương tự)
  - `reportError(error, context?)`: gọi `Sentry.captureException` nếu `shouldReport(error)` (mục 2). Khi Sentry chưa bật thì không làm gì.
  - `setMonitoringUser(id | null)`: gọi `Sentry.setUser({ id })` hoặc `Sentry.setUser(null)`.
  - `shouldReport(error)`: hàm thuần, export để test.
- **`vite.config.ts`:** `define` thêm `__APP_VERSION__` (từ `package.json`) và `__SENTRY_ENV__` (`process.env.VERCEL_ENV ?? 'local'`). Khai báo kiểu ở `src/vite-env.d.ts` cạnh `__USE_MOCK__`.
- **`src/main.tsx`:**
  - Gọi `initMonitoring()` trước `createRoot`.
  - Truyền `onUncaughtError` / `onRecoverableError` của React 19 vào `createRoot`, dùng `Sentry.reactErrorHandler()` qua `monitoring.ts`.
- **`.env.example`:** thêm `VITE_SENTRY_DSN=`, kèm ghi chú DSN không phải bí mật và bỏ trống thì không gửi lỗi.

## 2. Bắt lỗi ở đâu và lọc gì

| Nguồn lỗi | Cách bắt |
|---|---|
| Lỗi JS chưa ai bắt, promise bị từ chối không ai xử lý | Mặc định của Sentry (`GlobalHandlers`) |
| Lỗi render React ngoài router | `onUncaughtError` của `createRoot` |
| Lỗi trong route (loader, `lazy`, render trang) | `RouteError` đọc `useRouteError()` và gọi `reportError` trong `useEffect`. Giao diện giữ nguyên |
| Query / mutation lỗi | `QueryCache({ onError })` và `MutationCache({ onError })` trong `app/providers.tsx` gọi `reportError` kèm `queryKey` / `mutationKey` |

**`shouldReport(error)` trả `false` (không gửi) khi:**
- **Lỗi nghiệp vụ của feature:** `AuthError`, `StudioError`, `AdminError`, `GenreExistsError`, `BulkImportError`, `CoverError` / `ImageLimitError`, `ChapterNotSavedError`, `OfflineUnavailableError`, `OfflineStorageFullError`, `StorageFullError`.
  - Ngoại lệ: lỗi có `code === 'unknown'` vẫn gửi, vì đó là lỗi lạ đã bị gói lại.
  - Nhận diện bằng `error.name` để `monitoring.ts` không phải import từ các feature.
- **Lỗi PostgREST có mã dự kiến:** `P0001` (luật nghiệp vụ), `23505` (trùng), `PGRST103` (trang vượt tổng).
- **Lỗi mạng khi đang offline** (`!navigator.onLine`), hoặc `TypeError: Failed to fetch` / `Load failed` / `NetworkError`.
- **Không tải được chunk JS sau khi web vừa lên bản mới** (`Failed to fetch dynamically imported module`, `Importing a module script failed`). `RouteError` đã có nút tải lại cho trường hợp này.

Mọi lỗi khác đều gửi: lỗi PostgREST lạ (`42501` thiếu quyền, `22P02`…), lỗi `unknown`, lỗi code.

**Lỗi PostgREST không phải `Error`** (là object `{ code, message, details, hint }`). `reportError` gói lại thành `Error` có `name = 'PostgrestError'` và message `"<code>: <message>"`, đính `details` / `hint` vào `extra`. Như vậy Sentry gom nhóm đúng và không hiện "Object captured as exception".

## 3. Quyền riêng tư

- **Người dùng:** `AuthSync` (qua `useAuthSync`) gọi `setMonitoringUser(user?.id ?? null)` mỗi khi phiên đổi. Không gửi email, tên hay ảnh đại diện.
- **Xóa token trong URL** (`beforeSend` và `beforeBreadcrumb`): link đặt lại mật khẩu và `/auth/callback` của Supabase chứa `access_token`, `refresh_token`, `code`, `token_hash` trong query hoặc hash. Thay giá trị của các tham số này bằng `[đã ẩn]` trong:
  - `event.request.url`
  - URL của breadcrumb điều hướng / fetch
  - `event.request.headers.Referer`
- **Breadcrumb fetch:** chỉ giữ method, URL đã lọc và mã trạng thái, không ghi body.
- **Trang `/privacy`:** thêm một ý vào mục "Dữ liệu chúng tôi thu thập": khi web gặp lỗi kỹ thuật, thông tin lỗi (trang đang mở, trình duyệt, mã tài khoản) được gửi tới dịch vụ Sentry để sửa lỗi, không kèm email hay nội dung bạn nhập.

## 4. Source map và biến môi trường

- **`vite.config.ts`:**
  - `build.sourcemap: 'hidden'`: tạo file `.map` nhưng không thêm dòng `//# sourceMappingURL` vào file JS.
  - Thêm `sentryVitePlugin({ org: 'hanoi-university-of-business-a', project: 'web-novel-platform', authToken: process.env.SENTRY_AUTH_TOKEN, release: { name: version }, sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] }, telemetry: false })`.
  - Plugin chỉ thêm khi có `SENTRY_AUTH_TOKEN`, nên build ở máy và trong test không gọi Sentry.
- **PWA:** kiểm tra precache của `pwa.config.ts` không gồm file `.map`. Các file này đã bị xóa trước bước sinh service worker, cần xem lại thứ tự plugin.
- **Biến trên Vercel** (Settings → Environment Variables, cho cả Production và Preview):

  | Biến | Bí mật? | Ghi chú |
  |---|---|---|
  | `VITE_SENTRY_DSN` | Không | Lấy ở Sentry → Project Settings → Client Keys |
  | `SENTRY_AUTH_TOKEN` | **Có** | Organization token, người dùng tự thêm và không dán vào chat hay git. Hoặc cài Sentry integration từ Vercel Marketplace |

## 5. CSP

`vercel.json` → `connect-src` thêm `https://o4512213536866304.ingest.us.sentry.io` (host trong DSN). Cập nhật `src/app/securityHeaders.test.ts` nếu test kiểm danh sách này.

## 6. Kiểm tra

- **Test đơn vị `src/lib/monitoring.test.ts`:**
  - `shouldReport` với từng loại ở mục 2: `StudioError` thì không gửi; `AuthError('unknown')` thì gửi; PostgREST `P0001` không gửi, `42501` gửi; offline không gửi; lỗi chunk không gửi.
  - Lọc token: URL có `?code=…`, `#access_token=…&refresh_token=…` thì giá trị được thay bằng `[đã ẩn]`, các tham số khác giữ nguyên.
  - Gói lỗi PostgREST thành `Error` đúng tên và message.
- **Test tích hợp:** `vi.mock('@/lib/monitoring')`.
  - Query lỗi lạ thì gọi `reportError`.
  - Mutation ném `StudioError` thì `reportError` được gọi nhưng `shouldReport` chặn. Kiểm tra bằng hàm thật, không mock `shouldReport`.
  - `RouteError` gọi `reportError` với lỗi của route.
- **Build:** `npm run build` không có `SENTRY_AUTH_TOKEN` vẫn chạy được. So kích thước bundle trước và sau (ghi vào plan khi xong). `dist` không có `.map` khi build có token.
- **Thử trên bản preview của Vercel:**
  - Mở console, chạy `setTimeout(() => { throw new Error('Thử Sentry') })`. Lỗi phải hiện trong Sentry với đúng release, environment `preview` và stack trace về file `.ts` gốc. Email cảnh báo phải tới.
  - Thử luồng đặt lại mật khẩu, kiểm tra không có token nào lọt lên Sentry.
- `npm run typecheck`, `npm run lint`, `npm test`.

## 7. Các bước

1. Cài gói, viết `src/lib/monitoring.ts` và test đơn vị.
2. Nối vào `main.tsx`, `providers.tsx` (`QueryCache` / `MutationCache`), `RouteError` và `useAuthSync`, kèm test tích hợp.
3. `vite.config.ts` (define, source map, plugin Sentry), `.env.example`, CSP trong `vercel.json`, trang `/privacy`.
4. Người dùng thêm `VITE_SENTRY_DSN` và `SENTRY_AUTH_TOKEN` trên Vercel. Đẩy nhánh lên để có bản preview, rồi thử theo mục 6.
5. Cập nhật `CLAUDE.md` (mục Kiến trúc: theo dõi lỗi, cách lọc lỗi dự kiến, quy tắc lớp lỗi mới phải thêm vào `shouldReport`) và lộ trình. Chạy toàn bộ test, lint, build, rồi gộp vào `main`.

**Quy tắc về sau:** feature mới có lớp lỗi nghiệp vụ riêng (ví dụ `RewardError` của plan điểm danh) thì thêm tên lớp vào danh sách của `shouldReport`.
