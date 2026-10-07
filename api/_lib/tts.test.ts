import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RpcError } from './data.js'
import { handleTts, type TtsDeps, type TtsManifest } from './tts.js'
import { clipHash, clipKey } from './ttsText.js'

const CONTENT = '<p>Đoạn một.</p><p>***</p><p>Đoạn ba.</p><p>Đoạn bốn.</p>'
const TITLE_TEXT = 'Chương 3. Gặp lại.'

function setup(overrides: Partial<TtsDeps> = {}) {
  const stored = new Set<string>()
  const deps = {
    verifyUser: vi.fn(async (token: string) => (token === 'ok' ? 'user-1' : null)),
    loadChapter: vi.fn(async (slug: string, chapter: number) =>
      slug === 'truyen' && chapter === 3 ? { number: 3, title: 'Gặp lại', content: CONTENT } : null,
    ),
    lookup: vi.fn(async (_voice: string, hashes: string[]) => hashes.filter((h) => stored.has(h))),
    reserve: vi.fn(async () => {}),
    commit: vi.fn(async (_user: string, _voice: string, clips: { hash: string }[]) => {
      for (const clip of clips) stored.add(clip.hash)
    }),
    synthesize: vi.fn(
      async (text: string) => new Uint8Array(new TextEncoder().encode(`mp3:${text}`)),
    ),
    upload: vi.fn(async () => {}),
    publicUrl: (key: string) => `https://audio.test/${key}`,
    ...overrides,
  } satisfies TtsDeps
  return { deps, stored }
}

const post = (body: unknown, token: string | null = 'ok') =>
  new Request('https://site.test/api/tts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  })

const body = (extra: Record<string, unknown> = {}) => ({
  slug: 'truyen',
  chapter: 3,
  voice: 'Aoede',
  total: 4,
  generate: [],
  ...extra,
})

const url = (text: string) => `https://audio.test/${clipKey('Aoede', clipHash('Aoede', text))}`

describe('handleTts', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  test('chưa đăng nhập hoặc token sai: 401', async () => {
    expect((await handleTts(post(body(), null), ctx.deps)).status).toBe(401)
    const res = await handleTts(post(body(), 'sai'), ctx.deps)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: 'unauthenticated' })
  })

  test('input sai: 400 (giọng không có trong danh sách, quá nhiều đoạn, slug lạ)', async () => {
    for (const bad of [
      body({ voice: 'Khac' }),
      body({ generate: [0, 1, 2, 3, 0, 1] }),
      body({ slug: 'Truyện?x=1' }),
      'khong-phai-json',
    ]) {
      const res = await handleTts(post(bad), ctx.deps)
      expect(res.status).toBe(400)
    }
    expect(ctx.deps.reserve).not.toHaveBeenCalled()
  })

  test('đoạn ngoài chương (tạo sẵn chương sau) thì bỏ qua', async () => {
    const res = await handleTts(post(body({ total: undefined, generate: [3, 9] })), ctx.deps)
    expect(res.status).toBe(200)
    expect(ctx.deps.reserve).toHaveBeenCalledWith('user-1', [...'Đoạn bốn.'].length)
  })

  test('chương không công khai: 404; chương đã bị sửa (khác số đoạn): 409', async () => {
    expect((await handleTts(post(body({ chapter: 9 })), ctx.deps)).status).toBe(404)
    const res = await handleTts(post(body({ total: 5 })), ctx.deps)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ code: 'content_changed' })
  })

  test('chỉ hỏi: trả manifest, đoạn chưa có là null, đoạn không chữ là [], không trừ hạn mức', async () => {
    const res = await handleTts(post(body()), ctx.deps)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({
      total: 4,
      title: null,
      paragraphs: [null, [], null, null],
    } satisfies TtsManifest)
    expect(ctx.deps.reserve).not.toHaveBeenCalled()
    expect(ctx.deps.synthesize).not.toHaveBeenCalled()
  })

  test('tạo đoạn còn thiếu và tên chương: giữ đúng số ký tự, tải lên đúng khóa, ghi sổ', async () => {
    const res = await handleTts(post(body({ generate: [0, 2], title: true })), ctx.deps)
    const manifest = (await res.json()) as TtsManifest
    expect(manifest.title).toEqual([url(TITLE_TEXT)])
    expect(manifest.paragraphs).toEqual([[url('Đoạn một.')], [], [url('Đoạn ba.')], null])

    const chars = [...TITLE_TEXT].length + [...'Đoạn một.'].length + [...'Đoạn ba.'].length
    expect(ctx.deps.reserve).toHaveBeenCalledWith('user-1', chars)
    expect(ctx.deps.upload).toHaveBeenCalledWith(
      clipKey('Aoede', clipHash('Aoede', 'Đoạn một.')),
      expect.any(Uint8Array),
    )
    expect(ctx.deps.commit).toHaveBeenCalledWith('user-1', 'Aoede', expect.any(Array), 0)
    expect(vi.mocked(ctx.deps.commit).mock.calls[0][2]).toHaveLength(3)
  })

  test('đoạn đã có thì không gọi Google, không trừ hạn mức', async () => {
    await handleTts(post(body({ generate: [0] })), ctx.deps)
    vi.mocked(ctx.deps.reserve).mockClear()
    vi.mocked(ctx.deps.synthesize).mockClear()
    const res = await handleTts(post(body({ generate: [0] })), ctx.deps)
    expect(((await res.json()) as TtsManifest).paragraphs[0]).toEqual([url('Đoạn một.')])
    expect(ctx.deps.reserve).not.toHaveBeenCalled()
    expect(ctx.deps.synthesize).not.toHaveBeenCalled()
  })

  test('hết hạn mức: 429 với đúng mã, không gọi Google', async () => {
    for (const code of ['tts_daily_quota', 'tts_month_quota']) {
      const { deps } = setup({ reserve: vi.fn(async () => Promise.reject(new RpcError(code))) })
      const res = await handleTts(post(body({ generate: [0] })), deps)
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ code })
      expect(deps.synthesize).not.toHaveBeenCalled()
    }
  })

  test('Google lỗi một phần: hoàn lại số ký tự của phần lỗi, báo 503', async () => {
    const { deps } = setup({
      synthesize: vi.fn(async (text: string) => {
        if (text === 'Đoạn ba.') throw new Error('Google lỗi')
        return new Uint8Array(new TextEncoder().encode(text))
      }),
    })
    const res = await handleTts(post(body({ generate: [0, 2] })), deps)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ code: 'tts_unavailable' })
    expect(deps.commit).toHaveBeenCalledWith(
      'user-1',
      'Aoede',
      [expect.objectContaining({ hash: clipHash('Aoede', 'Đoạn một.') })],
      [...'Đoạn ba.'].length,
    )
  })
})
