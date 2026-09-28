/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** 'true': dùng dữ liệu giả (localStorage) dù đã cấu hình Supabase; test tự động luôn bật */
  readonly VITE_USE_MOCK?: string
  /** Nhà cung cấp đăng nhập đã bật trên Supabase, cách nhau bằng dấu phẩy, vd 'google,facebook' */
  readonly VITE_AUTH_PROVIDERS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
