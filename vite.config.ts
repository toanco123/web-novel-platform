import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { type HtmlTagDescriptor, loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { pwa } from './pwa.config.ts'
import { seoFiles } from './seo.config.ts'
import { DEFAULT_SITE_URL } from './src/config/site.ts'

/**
 * Gợi ý cho trình duyệt trong index.html:
 * - Mở sẵn kết nối tới Supabase trong lúc tải JS. Hai kết nối: API (fetch có CORS) và ảnh bìa
 *   (thẻ <img>, không CORS).
 * - Tải trước font chữ giao diện (Be Vietnam Pro 400, bộ latin + tiếng Việt) để chữ không đổi phông
 *   giữa chừng. Chỉ có khi build vì tên file font có hash.
 */
function htmlHints(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'html-hints',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const tags: HtmlTagDescriptor[] = []
        if (supabaseUrl) {
          const origin = new URL(supabaseUrl).origin
          tags.push(
            { tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' } },
            { tag: 'link', attrs: { rel: 'preconnect', href: origin } },
          )
        }
        for (const file of Object.keys(ctx.bundle ?? {})) {
          if (/be-vietnam-pro-(latin|vietnamese)-400-normal-[\w-]+\.woff2$/.test(file)) {
            tags.push({
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'font',
                type: 'font/woff2',
                href: `/${file}`,
                crossorigin: '',
              },
            })
          }
        }
        return tags.map((tag) => ({ ...tag, injectTo: 'head-prepend' as const }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Prefix '' để đọc cả biến không có VITE_ (PORT, HOST chỉ dùng cho dev server, không lộ ra client)
  const env = loadEnv(mode, process.cwd(), '')
  const server = {
    host: env.HOST || 'localhost',
    port: Number(env.PORT) || 3000,
    strictPort: true,
    // Dev server không chạy hàm Vercel: Giọng AI gọi /api/tts của một bản đã deploy (TTS_DEV_PROXY)
    ...(env.TTS_DEV_PROXY && {
      proxy: { '/api/tts': { target: env.TTS_DEV_PROXY, changeOrigin: true } },
    }),
  }
  // Dữ liệu giả thay cho Supabase: test tự động, chưa cấu hình .env, hoặc VITE_USE_MOCK=true. Thay
  // vào code lúc build (__USE_MOCK__) để bản build có Supabase loại hẳn api.mock.ts và src/mocks
  const useMock =
    mode === 'test' ||
    !!process.env.VITEST ||
    env.VITE_USE_MOCK === 'true' ||
    !env.VITE_SUPABASE_URL ||
    !env.VITE_SUPABASE_ANON_KEY
  const version: string = JSON.parse(readFileSync('package.json', 'utf-8')).version
  // Tải source map lên Sentry chỉ khi build trên Vercel có SENTRY_AUTH_TOKEN (bí mật, không ở .env).
  // Source map tạo dạng 'hidden' (file JS không trỏ tới) và bị xóa sau khi tải lên, nên người dùng
  // không tải được mã nguồn; không có token thì không tạo source map
  const uploadSourcemaps = !useMock && !!process.env.SENTRY_AUTH_TOKEN

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...pwa(),
      seoFiles(env.VITE_SITE_URL || DEFAULT_SITE_URL),
      htmlHints(useMock ? undefined : env.VITE_SUPABASE_URL),
      // Plugin Sentry phải đứng cuối
      uploadSourcemaps &&
        sentryVitePlugin({
          org: 'hanoi-university-of-business-a',
          project: 'web-novel-platform',
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: { name: version },
          sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
          telemetry: false,
        }),
    ],
    define: {
      __USE_MOCK__: JSON.stringify(useMock),
      __APP_VERSION__: JSON.stringify(version),
      __SENTRY_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? 'local'),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server,
    preview: server,
    build: {
      sourcemap: uploadSourcemaps ? 'hidden' : false,
      rolldownOptions: {
        treeshake: {
          // Dữ liệu giả (src/mocks, api.mock.ts) chỉ khai báo hàm/hằng: báo không có hiệu ứng phụ để
          // bản build dùng Supabase (USE_MOCK = false) loại hẳn, không tải về máy người dùng
          moduleSideEffects: (id: string) => !/[\\/]src[\\/]mocks[\\/]|\.mock\.ts$/.test(id),
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      // Test luồng đi qua nhiều trang, mỗi lần gọi api giả có độ trễ; chạy song song dễ quá 5s mặc định
      testTimeout: 10_000,
      // Test luôn chạy trên dữ liệu giả (api.mock.ts), không gọi Supabase thật dù .env có cấu hình
      env: { VITE_USE_MOCK: 'true' },
    },
  }
})
