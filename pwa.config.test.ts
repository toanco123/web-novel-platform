import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { offlineChunkFiles, SKIPPED_FONT_SUBSETS } from './pwa.config.ts'

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

const VIETNAMESE =
  'ĂăÂâĐđÊêÔôƠơƯưĨĩŨũÀàẢảÃãÁáẠạẰằẲẳẴẵẮắẶặẦầẨẩẪẫẤấẬậÈèẺẻẼẽÉéẸẹỀềỂểỄễẾếỆệÌìỈỉÍíỊị' +
  'ÒòỎỏÕõÓóỌọỒồỔổỖỗỐốỘộỜờỞởỠỡỚớỢợÙùỦủÚúỤụỪừỬửỮữỨứỰựỲỳỶỷỸỹÝýỴỵ₫'

type FontFace = { key: string; file: string; ranges: [number, number][] }

/** Các @font-face trong file CSS của @fontsource, đúng thứ tự khai báo */
function fontFaces(css: string): FontFace[] {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => {
    const prop = (name: string) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1] ?? ''
    return {
      key: ['font-family', 'font-style', 'font-weight'].map(prop).join('|'),
      file: prop('src').match(/url\(([^)]+)\)/)?.[1] ?? '',
      ranges: prop('unicode-range')
        .split(',')
        .map((range) => {
          const [from, to = from] = range.trim().slice(2).split('-')
          return [parseInt(from, 16), parseInt(to, 16)]
        }),
    }
  })
}

test('precache giữ đủ file font cho mọi chữ tiếng Việt (unicode-range chồng nhau thì trình duyệt dùng bộ khai báo sau)', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const imports = [...css.matchAll(/@import '(@fontsource[^']+)'/g)].map((m) => m[1])
  expect(imports.length).toBeGreaterThan(0)
  const offlineMissing: string[] = []
  for (const spec of imports) {
    const faces = fontFaces(readFileSync(`node_modules/${spec}`, 'utf8'))
    for (const key of new Set(faces.map((f) => f.key))) {
      for (const char of VIETNAMESE) {
        const code = char.codePointAt(0)!
        const used = faces
          .filter((f) => f.key === key)
          .findLast((f) => f.ranges.some(([from, to]) => code >= from && code <= to))
        if (used && SKIPPED_FONT_SUBSETS.some((subset) => used.file.includes(`-${subset}-`)))
          offlineMissing.push(`${char} (${used.file})`)
      }
    }
  }
  expect(offlineMissing).toEqual([])
})
