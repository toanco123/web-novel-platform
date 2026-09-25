# Plan: Màn hình Đăng nhập & Tạo tài khoản

## Context
Trang chủ đã xong (theme Mộng Truyện tối, header có nút "Đăng nhập" trỏ tới `/dang-nhap` nhưng đang ra 404). Bước này làm **UI đăng nhập / đăng ký / quên mật khẩu** với **auth giả (mock)**, đúng giai đoạn UI hiện tại. Mọi gọi auth đi qua `src/features/auth/api.ts` để sau này thay ruột bằng Supabase Auth mà không phải sửa component.

Đã chốt với người dùng:
- **Mức độ:** giao diện + auth giả.
- **Cách đăng nhập:** Email + mật khẩu, Google, Facebook.
- **Hiển thị:** trang riêng.
- **Form đăng ký:** tên hiển thị, email, mật khẩu (có ô nhập lại mật khẩu và ô đồng ý điều khoản).

**Trạng thái:** ✅ Hoàn thành UI + auth giả (25/09/2026). Chưa nối Supabase (xem mục 6). Tài khoản demo: `demo@webtruyen.vn` / `matkhau123`.

---

## 1. Route & bố cục

| Route | Trang |
|---|---|
| `/dang-nhap?next=/...` | Đăng nhập |
| `/dang-ky?next=/...` | Tạo tài khoản |
| `/quen-mat-khau` | Nhập email để nhận link đặt lại |
| `/dat-lai-mat-khau` | Đặt mật khẩu mới (trang đích của link trong email) |

Các trang này dùng **`AuthLayout`** riêng, không có header/footer đầy đủ, để người dùng tập trung vào form:

```
Desktop (lg+)                                   Mobile
┌─────────────────────────┬──────────────────┐  ┌──────────────────┐
│ Logo                    │  ← Về trang chủ  │  │ Logo       ← Về  │
│                         │                  │  │                  │
│   (3 bìa truyện xếp     │  Đăng nhập       │  │ Đăng nhập        │
│    quạt, nghiêng nhẹ)   │  Đọc tiếp truyện │  │ ...form...       │
│                         │  bạn đang theo   │  │                  │
│  "Năm Trường An không   │  dõi.            │  │                  │
│   có tuyết..."          │  [G] Google      │  └──────────────────┘
│   Trường An Không Tuyết │  [f] Facebook    │
│                         │  ── hoặc ──      │
│                         │  Email           │
│                         │  Mật khẩu   👁   │
│                         │  Quên mật khẩu?  │
│                         │  [ Đăng nhập ]   │
│                         │  Chưa có tài     │
│                         │  khoản? Tạo mới  │
└─────────────────────────┴──────────────────┘
```

- **Panel trái** (chỉ lg+): nền tím mận, 3 `StoryCover` xếp quạt, một câu trích dẫn từ truyện nổi bật. Lấy dữ liệu qua `useFeaturedStories()` đã có sẵn, không đọc mock trực tiếp.
- **Panel phải:** form rộng tối đa `max-w-sm`, căn giữa; có nút `ThemeToggle` và link "Về trang chủ".
- Đúng hệ thiết kế ở mục 8 của file plan chính: tiêu đề dùng `font-heading`, nút chính màu `primary` (hồng neon), link màu `rose-gold`.

## 2. Các form

**Đăng nhập:**
- Nút Google, nút Facebook, đường kẻ "hoặc".
- Email, Mật khẩu (có nút hiện/ẩn), link "Quên mật khẩu?".
- Nút "Đăng nhập", link "Chưa có tài khoản? Tạo tài khoản".

**Đăng ký:**
- Nút Google/Facebook ("Đăng ký với Google"), đường kẻ "hoặc".
- Tên hiển thị, Email, Mật khẩu (hiện/ẩn, kèm thanh độ mạnh 3 mức), Nhập lại mật khẩu.
- Checkbox "Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật" (link tới `paths.terms`, `paths.privacy`).
- Nút "Tạo tài khoản", link "Đã có tài khoản? Đăng nhập".

**Quên mật khẩu:** Email → nút "Gửi link đặt lại". Sau khi gửi luôn hiện: "Nếu email này đã đăng ký, bạn sẽ nhận được link đặt lại mật khẩu trong vài phút." Câu này không tiết lộ email có tồn tại hay không.

**Đặt lại mật khẩu:** Mật khẩu mới, Nhập lại → "Lưu mật khẩu mới", rồi chuyển sang trang đăng nhập với thông báo thành công.

**Quy tắc kiểm tra** (zod, lỗi bằng tiếng Việt, kiểm tra khi rời ô rồi kiểm tra lại mỗi lần gõ):
- Email: đúng định dạng. Lỗi: "Nhập email hợp lệ, ví dụ ten@gmail.com".
- Mật khẩu đăng ký: ≥ 8 ký tự, có cả chữ và số.
- Nhập lại mật khẩu phải khớp. Lỗi: "Mật khẩu nhập lại không khớp".
- Tên hiển thị: 2–30 ký tự, bỏ khoảng trắng thừa.
- Checkbox điều khoản bắt buộc.

**Lỗi từ server:** hiện ở đầu form với `role="alert"`, ví dụ:
- "Email hoặc mật khẩu không đúng."
- "Email này đã được đăng ký. Đăng nhập hoặc dùng email khác."

Trong lúc gửi form, nút bị khóa và hiện spinner, nhãn đổi thành "Đang đăng nhập…".

**Khả năng tiếp cận:** mỗi ô có `<label>`; ô lỗi có `aria-invalid` và `aria-describedby` trỏ tới dòng lỗi; khi submit lỗi thì focus vào ô lỗi đầu tiên (react-hook-form `shouldFocusError`); đặt `autocomplete` đúng (`email`, `current-password`, `new-password`, `name`).

## 3. Trạng thái đăng nhập (auth giả)

`src/features/auth/api.ts` là nơi duy nhất xử lý auth, gồm các hàm: `getSession`, `signInWithPassword`, `signUp`, `signInWithProvider('google' | 'facebook')`, `sendPasswordReset`, `updatePassword`, `signOut`.
- **Bản giả** lưu danh sách user và phiên đăng nhập trong `localStorage` (key `mock-auth-users`, `mock-auth-session`), có sẵn tài khoản demo `demo@webtruyen.vn` / `matkhau123`. Dữ liệu giả chỉ dùng khi dev, xóa khi nối Supabase.
- **Đăng nhập Google/Facebook giả:** chờ một chút rồi đăng nhập thành "Bạn đọc Google" / "Bạn đọc Facebook".
- **Kết quả `signUp`** có trường `needsEmailConfirmation`. Bản giả trả `false` và đăng nhập luôn; UI vẫn làm sẵn màn hình "Kiểm tra email của bạn" cho trường hợp `true`, dùng khi Supabase bật xác nhận email.

`src/features/auth/hooks.ts` dùng TanStack Query (đúng quy tắc trong CLAUDE.md, không dùng Zustand):
- `useSession()` có `queryKey: ['auth', 'session']`.
- `useSignIn`, `useSignUp`, `useSignInWithProvider`, `useSignOut`, `useSendPasswordReset`, `useUpdatePassword` là các mutation. Khi thành công chúng cập nhật cache phiên bằng `setQueryData`.

Kiểu dữ liệu `User = { id, email, displayName, avatarUrl | null, provider }` đặt ở `src/types/user.ts`.

**Chuyển hướng:**
- Header truyền `?next=<trang hiện tại>` khi bấm "Đăng nhập". Đăng nhập hoặc đăng ký xong thì `navigate(next, { replace: true })`.
- Hàm `safeNext()` chỉ chấp nhận đường dẫn bắt đầu bằng `/` và không phải `//`, để chặn chuyển hướng ra trang ngoài. Mặc định về `/`.
- Người đã đăng nhập mà mở `/dang-nhap` hoặc `/dang-ky` thì tự chuyển sang `next`.

## 4. Header khi đã đăng nhập
- **Desktop:** nút "Đăng nhập" được thay bằng avatar (chữ cái đầu của tên, dùng `ui/avatar`) mở `DropdownMenu` gồm tên và email, "Tủ truyện" (`paths.library`), "Tài khoản" (`/tai-khoan`), "Đăng xuất".
- **Mobile:** icon đăng nhập được thay bằng avatar tương tự; trong menu trượt thêm mục Tủ truyện và Đăng xuất.
- Trong lúc `useSession` đang tải, hiện một khung chờ tròn cùng kích thước để header không bị giật.

## 5. File cần tạo / sửa

**Tạo mới:**
- `src/layouts/AuthLayout.tsx`: bố cục 2 cột, panel bìa truyện.
- `src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`: `export default`, có `<title>` riêng.
- `src/features/auth/api.ts`, `hooks.ts`, `schemas.ts` (zod), `safeNext.ts`.
- `src/features/auth/components/`:
  - Form: `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`.
  - Phần dùng chung: `FormField` (label + ô nhập + dòng lỗi), `PasswordInput` (hiện/ẩn), `PasswordStrength`, `SocialButtons` (logo Google/Facebook bằng SVG nội tuyến, vì lucide v1 không có icon thương hiệu), `AuthDivider`, `FormAlert`, `UserMenu` (avatar và dropdown cho Header).
- `src/types/user.ts`.
- Thêm component shadcn `checkbox` (`npx shadcn@latest add checkbox`).

**Sửa:**
- `src/app/router.tsx`: thêm nhánh route dùng `AuthLayout` cho 4 trang (lazy như các trang khác).
- `src/lib/routes.ts`: thêm `register`, `forgotPassword`, `resetPassword`, `account`; đổi `login` thành hàm `login(next?)`.
- `src/components/common/Header.tsx`: truyền `next`, hiện `UserMenu` khi đã đăng nhập (cả desktop và mobile).
- `src/features/stories/sections/HeroShowcase.tsx`: nút "Thêm vào tủ truyện" khi chưa đăng nhập sẽ chuyển tới `paths.login(next)`.

**Dùng lại:** `Button`, `Input`, `Label`, `Avatar`, `DropdownMenu` (shadcn); `SiteLogo`, `ThemeToggle`, `Container`; `StoryCover`, `useFeaturedStories`; `paths`; `cn`.

## 6. Khi nối Supabase sau này (ghi chú, chưa làm)
- Ánh xạ hàm:
  - `signInWithPassword` → `supabase.auth.signInWithPassword`
  - `signUp` → `auth.signUp({ options: { data: { display_name }, emailRedirectTo } })`
  - `signInWithProvider` → `auth.signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback?next=…' } })`
  - `sendPasswordReset` → `auth.resetPasswordForEmail(email, { redirectTo: origin + '/dat-lai-mat-khau' })`
  - `updatePassword` → `auth.updateUser({ password })`
- `useSession` sẽ lắng nghe `onAuthStateChange` rồi `setQueryData`.
- Cần thêm route `/auth/callback`, trigger tạo `profiles` khi có user mới, và bật provider Google/Facebook trong Supabase Dashboard.

## 7. Kiểm tra
- **Test tự động** (`npm test`):
  - `schemas.test.ts`: email sai, mật khẩu yếu, nhập lại không khớp, chưa tick điều khoản.
  - `safeNext.test.ts`: chặn `//evil.com` và `https://…`.
  - `auth-flow.test.tsx` (memory router):
    - Sai mật khẩu thì hiện lỗi; đăng nhập tài khoản demo thì chuyển về `next` và header hiện avatar.
    - Đăng ký email trùng thì hiện lỗi; đăng ký mới thì đăng nhập luôn; đăng xuất thì hiện lại nút "Đăng nhập".
- `npm run build`, `npm run lint` đều sạch.
- **Kiểm tra bằng Playwright** ở 375px, 768px, 1440px, cả giao diện tối và sáng:
  - Không bị cuộn ngang; panel trái ẩn trên mobile.
  - Dùng Tab đi hết form được; lỗi hiện đúng chỗ.
  - Đi hết luồng: trang chủ → Đăng nhập → quay lại trang chủ với avatar → Đăng xuất.
