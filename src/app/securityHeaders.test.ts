// Header bảo mật trong vercel.json. CSP chỉ cho chạy script inline có hash đã khai báo, nên sửa script
// inline trong index.html (đọc theme) mà quên cập nhật hash thì trình duyệt chặn script đó.
import indexHtml from '../../index.html?raw'
import vercel from '../../vercel.json'

const siteHeaders = Object.fromEntries(
  vercel.headers
    .find((h) => h.source === '/(.*)')!
    .headers.map((h) => [h.key.toLowerCase(), h.value]),
)

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

test('CSP cho phép đúng các script inline của index.html', async () => {
  const scriptSrc = siteHeaders['content-security-policy']
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('script-src '))!
  const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  expect(inline.length).toBeGreaterThan(0)
  for (const script of inline) {
    expect(scriptSrc).toContain(`'sha256-${await sha256(script)}'`)
  }
})

test('không cho trang khác nhúng web vào iframe (chống clickjacking)', () => {
  expect(siteHeaders['x-frame-options']).toBe('DENY')
  expect(siteHeaders['content-security-policy']).toContain("frame-ancestors 'none'")
})

test('CSP cho phép gửi lỗi tới Sentry (host trong VITE_SENTRY_DSN)', () => {
  expect(siteHeaders['content-security-policy']).toMatch(
    /connect-src [^;]*https:\/\/o4512213536866304\.ingest\.us\.sentry\.io/,
  )
})

test('CSP cho phát file âm thanh của Giọng AI (R2, https) và clip im lặng (data:)', () => {
  expect(siteHeaders['content-security-policy']).toMatch(/media-src 'self' data: blob: https:;/)
})
