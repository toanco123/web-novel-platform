// Định tuyến trong vercel.json cho bot (hàm api/meta) và sitemap. Vercel so khớp giá trị của `has`
// trên cả chuỗi user-agent và không phân biệt hoa thường (đã thử trên bản deploy).
import vercel from '../../vercel.json'

type Rewrite = {
  source: string
  destination: string
  has?: { type: string; key: string; value: string }[]
}
const rewrites = vercel.rewrites as Rewrite[]
const botRule = rewrites.find((r) => r.destination === '/api/meta')!
const spaIndex = rewrites.findIndex((r) => r.destination === '/index.html')
const isBot = (userAgent: string) => new RegExp(`^${botRule.has![0].value}$`, 'i').test(userAgent)

test('rewrite của bot và sitemap đứng trước rewrite SPA', () => {
  expect(spaIndex).toBe(rewrites.length - 1)
  expect(rewrites.indexOf(botRule)).toBeLessThan(spaIndex)
  expect(rewrites.find((r) => r.source === '/sitemap.xml')?.destination).toBe('/api/sitemap')
  expect(botRule.has).toEqual([
    { type: 'header', key: 'user-agent', value: expect.stringMatching(/^\.\*\(.+\)\.\*$/) },
  ])
  // Không bắt request tới chính các hàm và file tĩnh của app
  expect(botRule.source).toBe('/((?!api/|assets/).*)')
})

test.each([
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; Zalo/1.0; +http://zalo.me)',
  'TelegramBot (like TwitterBot)',
  'Twitterbot/1.0',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  'WhatsApp/2.23.20.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (compatible; coccocbot-web/1.0; +http://help.coccoc.com/searchengine)',
])('bot được chuyển sang api/meta: %s', (userAgent) => {
  expect(isBot(userAgent)).toBe(true)
})

test.each([
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  // Trình duyệt trong app Facebook của người đọc thật
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0',
])('người đọc thường nhận index.html tĩnh: %s', (userAgent) => {
  expect(isBot(userAgent)).toBe(false)
})
