// Cấu hình PWA (vite-plugin-pwa): manifest, service worker Workbox. Service worker chỉ lo file tĩnh;
// chương đọc offline nằm trong IndexedDB do app quản lý (src/features/offline).
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { SITE_NAME, SITE_TAGLINE } from './src/config/site.ts'

type Chunk = {
  fileName: string
  imports: string[]
  dynamicImports: string[]
  isEntry: boolean
  facadeModuleId: string | null
}

/**
 * Bộ ký tự font không cần precache. Giữ latin-ext: bộ này khai báo sau bộ vietnamese và cũng chứa
 * Đ, Ă, Ơ, Ư, Ĩ, Ũ, ỹ..., nên trình duyệt lấy các chữ đó từ file latin-ext
 */
export const SKIPPED_FONT_SUBSETS = ['cyrillic', 'greek']

/** Trang chỉ dùng khi có mạng: khu Quản trị (Ant Design, biểu đồ) và Sáng tác (trình soạn Tiptap) */
const ONLINE_ONLY = /\/src\/pages\/(admin|studio)\//

/**
 * File JS cần để mở app offline: chunk vào app, các trang còn lại và mọi chunk chúng import (tĩnh
 * và động, vd workbox-window), trừ trang chỉ dùng khi có mạng cùng những gì chỉ chúng dùng
 */
export function offlineChunkFiles(chunks: Chunk[]): Set<string> {
  const byFile = new Map(chunks.map((c) => [c.fileName, c]))
  const files = new Set<string>()
  const visit = (file: string) => {
    const chunk = byFile.get(file)
    if (!chunk || files.has(file) || ONLINE_ONLY.test(chunk.facadeModuleId ?? '')) return
    files.add(file)
    chunk.imports.forEach(visit)
    chunk.dynamicImports.forEach(visit)
  }
  for (const c of chunks) {
    const id = c.facadeModuleId ?? ''
    if (c.isEntry || (id.includes('/src/pages/') && !ONLINE_ONLY.test(id))) visit(c.fileName)
  }
  return files
}

/** Ghi lại danh sách chunk khi build để lọc danh sách precache của Workbox */
function offlinePrecache() {
  let files = new Set<string>()
  const plugin: Plugin = {
    name: 'offline-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      files = offlineChunkFiles(
        Object.values(bundle).flatMap((output) => (output.type === 'chunk' ? [output] : [])),
      )
    },
  }
  const transform = async <T extends { url: string }>(entries: T[]) => ({
    manifest: entries.filter((e) => !e.url.endsWith('.js') || files.has(e.url)),
    warnings: [] as string[],
  })
  return { plugin, transform }
}

export function pwa() {
  const precache = offlinePrecache()
  return [
    precache.plugin,
    VitePWA({
      // Có bản mới thì hỏi (src/app/PwaUpdater.tsx), không tự tải lại trang khi đang đọc
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: SITE_NAME,
        short_name: SITE_NAME,
        description: SITE_TAGLINE,
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1a0f1d',
        theme_color: '#1a0f1d',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ảnh xem trước khi chia sẻ link chỉ bot dùng, không cần khi offline
        globIgnores: [...SKIPPED_FONT_SUBSETS.map((subset) => `**/*-${subset}*`), 'og-default.png'],
        manifestTransforms: [precache.transform],
        navigateFallback: '/index.html',
        // Không phải trang của app: để trình duyệt tải thẳng từ máy chủ
        navigateFallbackDenylist: [/^\/api\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
        runtimeCaching: [
          {
            // Ảnh bìa trên Supabase Storage: truyện đã lưu vẫn có bìa khi offline
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'story-covers',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Tắt service worker khi chạy dev (vướng HMR) và test
      devOptions: { enabled: false },
    }),
  ]
}
