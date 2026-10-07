// Bản gọi hàm Vercel (api.remote.ts): gửi access token, đổi mã lỗi của api/tts sang TtsError.
// Xử lý của chính hàm Vercel do api/_lib/tts.test.ts kiểm tra.
import { fetchClips } from './api.remote'
import { TtsError } from './shared'

const fake = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({ auth: { getSession: fake.getSession } }),
}))

const request = { slug: 'truyen', chapter: 1, voice: 'Aoede', total: 3, generate: [0], title: true }
const manifest = { total: 3, title: ['t'], paragraphs: [['a'], null, null] }

const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )

beforeEach(() => {
  fake.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
})
afterEach(() => vi.unstubAllGlobals())

test('gửi request kèm access token, trả manifest', async () => {
  respond(200, manifest)
  await expect(fetchClips(request)).resolves.toEqual(manifest)
  const [url, init] = vi.mocked(fetch).mock.calls[0]
  expect(url).toBe('/api/tts')
  expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(request) })
  expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok')
})

test('chưa đăng nhập thì không gọi máy chủ', async () => {
  fake.getSession.mockResolvedValue({ data: { session: null } })
  respond(200, manifest)
  await expect(fetchClips(request)).rejects.toMatchObject({ code: 'unauthenticated' })
  expect(fetch).not.toHaveBeenCalled()
})

test('đổi mã lỗi của máy chủ sang TtsError; mã lạ là unknown; mất mạng là network', async () => {
  respond(429, { code: 'tts_month_quota' })
  await expect(fetchClips(request)).rejects.toEqual(new TtsError('tts_month_quota'))
  respond(500, { code: 'loi_la' })
  await expect(fetchClips(request)).rejects.toMatchObject({ name: 'TtsError', code: 'unknown' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  )
  await expect(fetchClips(request)).rejects.toMatchObject({ code: 'network' })
})
