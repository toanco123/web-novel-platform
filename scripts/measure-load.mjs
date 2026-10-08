// Đo tốc độ tải trang (plan documents/plan-toi-uu-tai-trang-dot-3.md mục 4): mạng chậm kiểu "Slow
// 4G" của Lighthouse (độ trễ 150 ms, tải xuống 1,6 Mbps, tải lên 750 Kbps), CPU chậm 4 lần, khổ điện
// thoại, không dùng cache. Mỗi trang đo 3 lần, in trung vị FCP, LCP và thời điểm request dữ liệu
// (Supabase /rest/v1/) đầu tiên.
//
// Dùng: node scripts/measure-load.mjs <địa chỉ gốc> <đường dẫn>...
//   vd:  node scripts/measure-load.mjs http://localhost:4173 / /story/abc /story/abc/chapter-1
import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const [base, ...pagePaths] = process.argv.slice(2)
if (!base || !pagePaths.length) {
  console.error('Dùng: node scripts/measure-load.mjs <địa chỉ gốc> <đường dẫn>...')
  process.exit(1)
}
const RUNS = 3

/** Mở Chromium của playwright-core; không có đúng bản thì dùng bản headless mới nhất trong cache */
async function launch() {
  try {
    return await chromium.launch()
  } catch {
    const cache = join(homedir(), 'Library/Caches/ms-playwright')
    const dir = readdirSync(cache)
      .filter((d) => d.startsWith('chromium_headless_shell-'))
      .sort()
      .at(-1)
    if (!dir) throw new Error('Không thấy Chromium nào trong ' + cache)
    return chromium.launch({
      executablePath: join(cache, dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
    })
  }
}

async function measure(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.6,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(1000)
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
        const data = performance
          .getEntriesByType('resource')
          .filter((e) => e.name.includes('/rest/v1/'))
          .map((e) => e.startTime)
        let lcp = null
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          lcp = entries.at(-1)?.startTime ?? lcp
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        setTimeout(
          () => resolve({ fcp, lcp, firstData: data.length ? Math.min(...data) : null }),
          200,
        )
      }),
  )
  await context.close()
  return result
}

const median = (values) => {
  const sorted = values.filter((v) => v !== null).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
}
const seconds = (ms) => (ms === null ? '   –  ' : `${(ms / 1000).toFixed(2)} s`)

const browser = await launch()
console.log(`Đo ${base} (trung vị ${RUNS} lần)`)
console.log('Trang'.padEnd(46), 'FCP'.padStart(8), 'LCP'.padStart(8), 'Dữ liệu đầu'.padStart(12))
for (const path of pagePaths) {
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, base + path))
  console.log(
    path.slice(0, 45).padEnd(46),
    seconds(median(runs.map((r) => r.fcp))).padStart(8),
    seconds(median(runs.map((r) => r.lcp))).padStart(8),
    seconds(median(runs.map((r) => r.firstData))).padStart(12),
  )
}
await browser.close()
