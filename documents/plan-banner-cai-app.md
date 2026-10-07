# Plan: Banner giới thiệu app di động

## Context
App di động (Expo, thư mục `mobile-novel-platform`) sắp phát hành lên App Store và Google Play. Web cần một banner ở cuối màn hình để người đọc trên điện thoại biết có app và bấm cài.

Đã chốt với người dùng (07/10/2026):
- **Chỉ điện thoại:** banner hiện trên iOS/Android đang mở web bằng trình duyệt, bấm là sang đúng store của máy (iPhone/iPad → App Store, Android → Google Play). Máy tính không hiện.
- **Làm sẵn, ẩn tới khi có link:** link store khai báo bằng biến môi trường; nền tảng nào chưa có link thì banner không hiện trên nền tảng đó. App lên store thì chỉ cần thêm biến trên Vercel rồi deploy lại, không sửa code.
- **Tắt thì 30 ngày sau mới hiện lại.**
- Cách làm: banner tự làm bằng React (không dùng banner `apple-itunes-app` của Safari hay `related_applications` của manifest: banner của Safari nằm ở đầu trang, chỉ có trên Safari, không chỉnh giao diện được).

**Trạng thái:** ✅ Xong (07/10/2026). Banner chỉ hiện khi đã khai báo link store trên Vercel.

---

## 1. Cấu hình (`src/config/mobileApp.ts`)
- Hai biến môi trường mới, khai báo trong `.env.example` và trên Vercel (Production và Preview):
  - `VITE_APP_STORE_URL`: link App Store, vd `https://apps.apple.com/app/id1234567890`.
  - `VITE_PLAY_STORE_URL`: link Google Play, vd `https://play.google.com/store/apps/details?id=com.webtruyen.app`.
- `src/config/mobileApp.ts` export `storeUrl(platform: 'ios' | 'android'): string | null`, đọc `import.meta.env`, bỏ khoảng trắng; chuỗi rỗng hay không bắt đầu bằng `https://` thì coi như chưa có (`null`). File này dùng `import.meta` nên tách riêng, không gộp vào `src/config/site.ts` (file đó hàm Vercel cũng đọc).
- Link store là điều hướng bình thường (`<a href>`), không phải tải tài nguyên, nên CSP trong `vercel.json` không cần sửa.

## 2. Nhận biết thiết bị (`src/lib/platform.ts`)
- Hàm thuần `mobilePlatform(ua: string, maxTouchPoints: number): 'ios' | 'android' | null`:
  - `android` khi UA chứa `Android`.
  - `ios` khi UA chứa `iPhone`, `iPad` hoặc `iPod`, **hoặc** UA là `Macintosh` mà `maxTouchPoints > 1` (iPadOS 13+ tự báo là Mac).
  - Còn lại `null` (máy tính, kể cả Mac thật có `maxTouchPoints` 0).
- Hàm `isStandalone(): boolean`: `matchMedia('(display-mode: standalone)').matches` hoặc `navigator.standalone === true` (Safari iOS). Đang mở trong PWA đã cài thì không hiện banner: người dùng đã có bản "như app" trên màn hình chính, không nhắc thêm.
- `currentMobilePlatform()` đọc `navigator` rồi gọi `mobilePlatform()`, nên test thuần chỉ cần gọi `mobilePlatform()` với chuỗi UA.

## 3. Ghi nhớ khi tắt (`src/features/appBanner/useAppBanner.ts`)
- Zustand + persist, key localStorage **`app-banner`**, state `{ dismissedAt: number | null }`, action `dismiss()` ghi `Date.now()`.
- Hằng `SNOOZE_DAYS = 30`. Hàm thuần `isSnoozed(dismissedAt, now)`: `true` nếu `dismissedAt !== null` và `now - dismissedAt < 30 ngày`.
- Bấm **✕** hoặc bấm **"Tải app"** đều gọi `dismiss()`: đã sang store rồi thì 30 ngày sau mới nhắc lại.
- localStorage bị chặn (chế độ riêng tư): persist của Zustand tự bỏ qua lỗi ghi; banner vẫn tắt được trong phiên hiện tại, lần mở sau có thể hiện lại. Chấp nhận.

## 4. Điều kiện hiện banner
Hook `useAppBannerTarget()` (`src/features/appBanner/useAppBanner.ts`) trả `{ platform, url } | null`. Banner hiện khi **tất cả** đều đúng:
1. `mobilePlatform()` khác `null` và `storeUrl(platform)` khác `null`.
2. `isStandalone()` là `false`.
3. `isSnoozed(dismissedAt, Date.now())` là `false`.
4. Đường dẫn hiện tại không bắt đầu bằng `/studio` (khu Sáng tác có thanh lưu cố định ở đáy `ChapterEditor`, và người viết đang làm việc).

Banner chỉ gắn trong `MainLayout`, nên tự nhiên **không** có ở trang đọc chương (`ReaderLayout`, đã có `FloatingBar` ở đáy và không được làm phiền khi đọc), trang đăng nhập/đăng ký (`AuthLayout`) và khu quản trị.

## 5. Giao diện (`src/features/appBanner/AppBanner.tsx`)
- Gắn ở cuối `MainLayout`, sau `<Footer />`, dạng `sticky bottom-0 z-30`: khi cuộn thì dính đáy màn hình, cuộn tới cuối trang thì nằm ngay dưới footer nên không che footer (không cần chừa khoảng trống).
- Bố cục một hàng, cao khoảng 64px, nền `bg-card/95` + `backdrop-blur`, viền trên `border-t`, đệm đáy `pb-[max(0.75rem,env(safe-area-inset-bottom))]`:
  - Nút **✕** bên trái (`aria-label="Đóng"`, vùng bấm ≥ 40px).
  - Biểu tượng logo (biểu tượng "Sách nở hoa" trên nền tối bo góc như icon app, 40px; phần vẽ biểu tượng tách thành `MarkShapes`/`LogoMark` ở `src/components/common/LogoMark.tsx`, `SiteLogo` dùng lại).
  - Hai dòng chữ: **"App Web Truyện"** (`App ${SITE_NAME}`, `font-medium text-sm`; câu dài hơn bị cắt ở 375px) và **"Đọc offline, báo chương mới"** (`text-xs text-muted-foreground`). Tên app cắt bằng `truncate`; dòng phụ được xuống tối đa 2 dòng (`line-clamp-2`) ở màn hẹp (360px trở xuống).
  - Nút **"Tải app"** bên phải (`Button` màu primary, cao ≥ 40px để dễ bấm; `size="sm"` chỉ cao 28px nên không dùng), là `<a href={url} target="_blank" rel="noopener">`.
- Là vùng `role="region"` với `aria-label="Giới thiệu app di động"`, đặt trong DOM sau footer nên trình đọc màn hình gặp cuối cùng, không chen trước nội dung chính.
- Hiện bằng hiệu ứng trượt lên (`motion-safe:animate-in slide-in-from-bottom`); bật giảm chuyển động thì hiện luôn.
- Kiểm tra ở 375px và cả hai theme; ở 768px trở lên chỉ hiện khi là máy tính bảng (iPad), bố cục vẫn một hàng, nội dung căn giữa trong `Container`.

## 6. Toast không bị che
- `Toaster` (sonner, `bottom-center`, ở `src/app/providers.tsx`) nằm đúng chỗ banner.
- Khi hiện, banner đo chiều cao của mình (`ResizeObserver`) và ghi vào biến CSS `--app-banner-h` trên `document.documentElement`; ẩn hoặc unmount thì xóa biến.
- `Toaster` thêm `offset` và `mobileOffset` với `bottom: 'calc(<khoảng mặc định> + var(--app-banner-h, 0px))'`, nên toast (kể cả "Có phiên bản mới" hiện mãi) luôn nổi trên banner.

## 7. Kiểm thử
- **Test thuần:**
  - `mobilePlatform()`: UA iPhone Safari, iPad iPadOS (Macintosh + `maxTouchPoints` 5), Android Chrome, Chrome máy tính Windows, Mac thật (`maxTouchPoints` 0).
  - `isSnoozed()`: chưa tắt; tắt 29 ngày trước; tắt đúng 30 ngày trước.
  - `storeUrl()`: biến rỗng, chỉ có khoảng trắng, không phải `https://`, link hợp lệ.
- **Test tích hợp** (`renderApp`, giả `navigator.userAgent` và biến môi trường bằng `vi.stubEnv`):
  - iPhone + có `VITE_APP_STORE_URL` → trang chủ có banner, nút "Tải app" trỏ đúng link App Store.
  - Android + có `VITE_PLAY_STORE_URL` → link Google Play.
  - iPhone nhưng chỉ có link Google Play → không có banner.
  - Máy tính → không có banner.
  - Trang đọc chương, trang đăng nhập, `/studio` → không có banner.
  - Bấm ✕ → banner biến mất, localStorage `app-banner` có `dismissedAt`; render lại vẫn ẩn; đặt `dismissedAt` lùi 31 ngày → hiện lại.
  - Bấm "Tải app" → banner ẩn như bấm ✕.

## 8. Tài liệu
- `.env.example`: thêm hai biến ở mục 1, kèm chú thích "bỏ trống thì không hiện banner".
- `CLAUDE.md`: một dòng về banner (vị trí, key `app-banner`, biến môi trường).
- `documents/plan-bo-cuc-va-cong-nghe.md`: đánh dấu tiến độ khi xong.
- Khi app phát hành (bước 5d bên mobile): điền hai biến trên Vercel rồi deploy lại.

## Ngoài phạm vi
- Nút "Mở trong app" khi máy đã cài app: cần Universal Links / App Links (`public/.well-known/apple-app-site-association`, `assetlinks.json`), thuộc bước 5d bên mobile.
- Banner `apple-itunes-app` của Safari (hướng C): cân nhắc lại khi đã có Universal Links.
- Máy tính (thẻ có mã QR).
- Thống kê lượt hiện/bấm banner.
- Ẩn nút "Cài ứng dụng" (PWA) trên Android khi đã có app thật.
