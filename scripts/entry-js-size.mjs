// Tổng JS tải lúc vào trang của một bản build: script chính + modulepreload trong index.html,
// tính theo gzip. Dùng: node scripts/entry-js-size.mjs [thư mục dist]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = process.argv[2] ?? 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const files = [
  ...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+modulepreload[^>]+href="\/([^"]+\.js)"/g),
].map((m) => m[1])
let total = 0
for (const file of new Set(files)) {
  const size = gzipSync(readFileSync(join(dist, file))).length
  total += size
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`)
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  TỔNG (gzip, ${new Set(files).size} file)`)
