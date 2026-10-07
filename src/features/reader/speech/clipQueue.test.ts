import { describe, expect, test, vi } from 'vitest'
import { createClipQueue } from './clipQueue'

type Req = Parameters<Parameters<typeof createClipQueue>[0]['fetchClips']>[0]

/** Máy chủ giả: chương có `total` đoạn, đoạn được tạo khi nằm trong `generate` */
function fakeServer(total = 10) {
  const made = new Set<string>()
  const requests: Req[] = []
  const fetchClips = vi.fn(async (req: Req) => {
    requests.push(req)
    const key = (i: number | 'title') => `${req.voice}|${req.chapter}|${i}`
    for (const i of req.generate) if (i < total) made.add(key(i))
    if (req.title) made.add(key('title'))
    return {
      total,
      title: req.title ? [`title-${req.chapter}`] : null,
      paragraphs: Array.from({ length: total }, (_, i) =>
        made.has(key(i)) ? [`url-${req.chapter}-${i}`] : null,
      ),
    }
  })
  return { fetchClips, requests }
}

const error = (code: string) => Object.assign(new Error(code), { code })
const target = { voice: 'Aoede', slug: 'truyen', chapter: 1, total: 10, title: false }
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('createClipQueue', () => {
  test('đoạn chưa có: tạo cả đoạn đó và vài đoạn sau trong một request', async () => {
    const server = fakeServer()
    const queue = createClipQueue({ fetchClips: server.fetchClips, error })
    const result = await queue.clips({ ...target, index: 0, title: true })
    expect(result).toEqual({ title: ['title-1'], parts: ['url-1-0'] })
    expect(server.requests[0]).toMatchObject({ generate: [0, 1, 2, 3], title: true, total: 10 })
  })

  test('đoạn đã có thì không hỏi lại; gần hết cửa sổ thì tạo trước ở nền', async () => {
    const server = fakeServer()
    const queue = createClipQueue({ fetchClips: server.fetchClips, error })
    await queue.clips({ ...target, index: 0 })
    await queue.clips({ ...target, index: 1 })
    // Đoạn 4 chưa có nằm trong cửa sổ sau đoạn 1 → một request nền
    await flush()
    expect(server.requests).toHaveLength(2)
    expect(server.requests[1].generate).toEqual([4])
    await queue.clips({ ...target, index: 2 })
    await flush()
    expect(server.requests[2].generate).toEqual([5])
  })

  test('đang có request chạy thì chờ request đó thay vì gửi trùng', async () => {
    const server = fakeServer()
    const queue = createClipQueue({ fetchClips: server.fetchClips, error })
    await Promise.all([queue.clips({ ...target, index: 0 }), queue.clips({ ...target, index: 1 })])
    // Một request cho đoạn 0–3; request còn lại (nếu có) chỉ là tạo trước đoạn 4
    expect(server.requests.filter((r) => r.generate.includes(1))).toHaveLength(1)
    expect(server.requests.slice(1).every((r) => r.generate.join() === '4')).toBe(true)
  })

  test('số đoạn khác với máy chủ (chương đã sửa) thì báo content_changed', async () => {
    const server = fakeServer(12)
    const queue = createClipQueue({ fetchClips: server.fetchClips, error })
    await expect(queue.clips({ ...target, index: 0 })).rejects.toThrow('content_changed')
  })

  test('máy chủ trả lỗi thì ném lỗi đó; vẫn chưa có đoạn thì báo tts_unavailable', async () => {
    const failing = createClipQueue({
      fetchClips: async () => Promise.reject(error('tts_daily_quota')),
      error,
    })
    await expect(failing.clips({ ...target, index: 0 })).rejects.toThrow('tts_daily_quota')

    const empty = createClipQueue({
      fetchClips: async () => ({ total: 10, title: null, paragraphs: Array(10).fill(null) }),
      error,
    })
    await expect(empty.clips({ ...target, index: 0 })).rejects.toThrow('tts_unavailable')
  })

  test('tạo trước chương sau: tên chương và hai đoạn đầu, không cần biết số đoạn', async () => {
    const server = fakeServer()
    const queue = createClipQueue({ fetchClips: server.fetchClips, error })
    queue.warm('Aoede', 'truyen', 2)
    queue.warm('Aoede', 'truyen', 2)
    await flush()
    expect(server.requests).toEqual([
      { slug: 'truyen', chapter: 2, voice: 'Aoede', generate: [0, 1], title: true },
    ])
    expect(queue.peek('Aoede', 'truyen', 2, 0)).toBe('url-2-0')
    // Đọc tới chương 2: tên chương và đoạn đầu đã có, không gửi lại
    await queue.clips({ ...target, chapter: 2, index: 0, title: true })
    expect(server.requests.filter((r) => r.chapter === 2 && r.generate.includes(0))).toHaveLength(1)
  })
})
