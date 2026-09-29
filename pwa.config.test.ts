import { expect, test } from 'vitest'
import { offlineChunkFiles } from './pwa.config.ts'

const chunk = (
  fileName: string,
  facadeModuleId: string | null,
  imports: string[] = [],
  isEntry = false,
) => ({ fileName, facadeModuleId, imports, isEntry, dynamicImports: [] as string[] })

test('giữ chunk vào app và các trang thường cùng chunk chúng import; bỏ khu Quản trị và Sáng tác', () => {
  const files = offlineChunkFiles([
    chunk('assets/index.js', '/app/index.html', ['assets/vendor.js'], true),
    chunk('assets/vendor.js', null),
    chunk('assets/ChapterReaderPage.js', '/app/src/pages/ChapterReaderPage.tsx', [
      'assets/reader.js',
    ]),
    chunk('assets/reader.js', null),
    chunk('assets/AdminDashboardPage.js', '/app/src/pages/admin/AdminDashboardPage.tsx', [
      'assets/antd.js',
    ]),
    chunk('assets/antd.js', null),
    chunk('assets/ChapterEditorPage.js', '/app/src/pages/studio/ChapterEditorPage.tsx', [
      'assets/tiptap.js',
      'assets/vendor.js',
    ]),
    chunk('assets/tiptap.js', null),
  ])
  expect([...files].sort()).toEqual([
    'assets/ChapterReaderPage.js',
    'assets/index.js',
    'assets/reader.js',
    'assets/vendor.js',
  ])
})

test('giữ cả chunk import động (vd workbox-window của bản đăng ký service worker), trừ trang cần mạng', () => {
  const files = offlineChunkFiles([
    {
      ...chunk('assets/index.js', '/app/index.html', [], true),
      dynamicImports: ['assets/workbox-window.js', 'assets/AdminShell.js'],
    },
    chunk('assets/workbox-window.js', '/app/node_modules/workbox-window/build/index.mjs'),
    chunk('assets/AdminShell.js', '/app/src/pages/admin/AdminShell.tsx', ['assets/antd.js']),
    chunk('assets/antd.js', null),
  ])
  expect([...files].sort()).toEqual(['assets/index.js', 'assets/workbox-window.js'])
})
