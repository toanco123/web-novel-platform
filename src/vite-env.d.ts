/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** 'true': dùng dữ liệu giả (localStorage) dù đã cấu hình Supabase; test tự động luôn bật */
  readonly VITE_USE_MOCK?: string
  /** Nhà cung cấp đăng nhập đã bật trên Supabase, cách nhau bằng dấu phẩy, vd 'google,facebook' */
  readonly VITE_AUTH_PROVIDERS?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /** Địa chỉ web (canonical, sitemap, ảnh xem trước); bỏ trống thì dùng DEFAULT_SITE_URL */
  readonly VITE_SITE_URL?: string
  /** Link App Store / Google Play của app di động; bỏ trống thì không hiện banner mời tải app */
  readonly VITE_APP_STORE_URL?: string
  readonly VITE_PLAY_STORE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
