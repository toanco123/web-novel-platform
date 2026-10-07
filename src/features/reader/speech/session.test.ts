import { describe, expect, test, vi } from 'vitest'
import {
  createSpeechSession,
  type SpeakJob,
  type SpeechChapter,
  type SpeechEngine,
  type SpeechSessionOptions,
  type SpeechState,
} from './session'

/** Engine giả: ghi lại từng đoạn được đọc; test tự quyết khi nào đọc xong / lỗi */
function fakeEngine(name: string, extra: Partial<SpeechEngine> = {}) {
  const calls: { job: SpeakJob; done: () => void; fail: (e: unknown) => void }[] = []
  const engine: SpeechEngine & { calls: typeof calls; name: string } = {
    name,
    calls,
    speak: vi.fn(
      (job: SpeakJob) =>
        new Promise<void>((resolve, reject) => calls.push({ job, done: resolve, fail: reject })),
    ),
    cancel: vi.fn(),
    ...extra,
  }
  return engine
}

const chapters: Record<number, SpeechChapter> = {
  1: { number: 1, title: 'Mở đầu', paragraphs: ['a', 'b', 'c'], next: 2 },
  2: { number: 2, title: 'Tiếp', paragraphs: ['d', 'e'], next: null },
}

function setup(overrides: Partial<SpeechSessionOptions> = {}) {
  const states: SpeechState[] = []
  const onAdvance = vi.fn()
  const onFallback = vi.fn()
  const device = fakeEngine('device')
  const session = createSpeechSession({
    loadChapter: async (_slug, n) => chapters[n] ?? null,
    device,
    autoNext: () => true,
    onState: (s) => states.push(s),
    onAdvance,
    onFallback,
    settleMs: 0,
    ...overrides,
  })
  const last = () => states[states.length - 1]
  return { session, device, states, last, onAdvance, onFallback }
}

/** Chờ các promise và setTimeout(0) đang chờ chạy xong */
const flush = () => new Promise((r) => setTimeout(r, 5))

describe('createSpeechSession', () => {
  test('đọc tên chương rồi từng đoạn, hết chương thì sang chương sau', async () => {
    const { session, device, last, onAdvance } = setup()
    session.start('truyen', 1)
    await flush()
    expect(device.calls[0].job).toMatchObject({ index: 0, text: 'a', title: 'Chương 1. Mở đầu.' })
    expect(last()).toMatchObject({ status: 'playing', chapter: 1, paragraph: 0, total: 3 })

    device.calls[0].done()
    await flush()
    expect(device.calls[1].job).toMatchObject({ index: 1, text: 'b', title: null })
    expect(last().paragraph).toBe(1)

    device.calls[1].done()
    await flush()
    device.calls[2].done()
    await flush()
    expect(onAdvance).toHaveBeenCalledWith('truyen', 2)
    expect(device.calls[3].job).toMatchObject({ chapter: 2, index: 0, title: 'Chương 2. Tiếp.' })
  })

  test('bắt đầu giữa chương thì không đọc tên chương; hết truyện thì về idle', async () => {
    const { session, device, last } = setup()
    session.start('truyen', 2, 1)
    await flush()
    expect(device.calls[0].job).toMatchObject({ index: 1, title: null })
    device.calls[0].done()
    await flush()
    expect(last().status).toBe('idle')
  })

  test('tắt tự chuyển chương thì hết chương là dừng', async () => {
    const { session, device, last, onAdvance } = setup({ autoNext: () => false })
    session.start('truyen', 2, 1)
    await flush()
    device.calls[0].done()
    await flush()
    expect(onAdvance).not.toHaveBeenCalled()
    expect(last().status).toBe('idle')
  })

  test('không tải được chương thì về idle', async () => {
    const { session, device, last } = setup()
    session.start('truyen', 99)
    await flush()
    expect(device.speak).not.toHaveBeenCalled()
    expect(last().status).toBe('idle')
  })

  test('engine không có pause: tạm dừng = dừng hẳn, nghe tiếp đọc lại cả đoạn', async () => {
    const { session, device, last } = setup()
    session.start('truyen', 1, 1)
    await flush()
    session.pause()
    expect(device.cancel).toHaveBeenCalled()
    expect(last()).toMatchObject({ status: 'paused', paragraph: 1 })
    // Đoạn cũ "đọc xong" sau khi đã dừng thì bị bỏ qua
    device.calls[0].done()
    await flush()
    expect(device.calls).toHaveLength(1)

    session.resume()
    await flush()
    expect(device.calls[1].job.index).toBe(1)
    expect(last().status).toBe('playing')
  })

  test('engine có pause: tạm dừng giữ nguyên vị trí', async () => {
    const pause = vi.fn()
    const resume = vi.fn()
    const ai = fakeEngine('ai', { pause, resume })
    const { session, last } = setup({ ai, useAi: () => true })
    session.start('truyen', 1)
    await flush()
    session.pause()
    expect(pause).toHaveBeenCalled()
    expect(last().status).toBe('paused')
    session.resume()
    expect(resume).toHaveBeenCalled()
    expect(last().status).toBe('playing')
    expect(ai.calls).toHaveLength(1)
  })

  test('nhảy đoạn trong giới hạn của chương', async () => {
    const { session, device } = setup()
    session.start('truyen', 1, 2)
    await flush()
    session.skip(1)
    await flush()
    expect(device.calls[1].job.index).toBe(2)
    session.skip(-5)
    await flush()
    expect(device.calls[2].job.index).toBe(0)
  })

  test('đổi tốc độ: engine có setRate thì đổi ngay, không thì đọc lại đoạn', async () => {
    const setRate = vi.fn()
    const ai = fakeEngine('ai', { setRate })
    const withAi = setup({ ai, useAi: () => true })
    withAi.session.start('truyen', 1)
    await flush()
    withAi.session.setRate(1.5)
    expect(setRate).toHaveBeenCalledWith(1.5)
    expect(ai.calls).toHaveLength(1)

    const { session, device } = setup()
    session.start('truyen', 1, 1)
    await flush()
    session.setRate(1.5)
    await flush()
    expect(device.calls.map((c) => c.job.index)).toEqual([1, 1])
  })

  test('Giọng AI lỗi ở đoạn k: giọng của máy đọc tiếp từ k, báo một lần', async () => {
    const ai = fakeEngine('ai')
    const { session, device, onFallback } = setup({ ai, useAi: () => true })
    session.start('truyen', 1)
    await flush()
    ai.calls[0].done()
    await flush()
    const error = new Error('tts_daily_quota')
    ai.calls[1].fail(error)
    await flush()
    expect(onFallback).toHaveBeenCalledWith(error, true)
    expect(device.calls[0].job).toMatchObject({ index: 1, text: 'b' })

    device.calls[0].done()
    await flush()
    expect(device.calls[1].job.index).toBe(2)
    expect(ai.calls).toHaveLength(2)
    expect(onFallback).toHaveBeenCalledTimes(1)

    // Tắt hẳn rồi nghe lại thì thử Giọng AI lại
    session.stop()
    session.start('truyen', 1)
    await flush()
    expect(ai.calls).toHaveLength(3)
  })

  test('Giọng AI lỗi mà máy không có giọng đọc thì dừng', async () => {
    const ai = fakeEngine('ai')
    const { session, last, onFallback } = setup({ ai, device: null, useAi: () => true })
    session.start('truyen', 1)
    await flush()
    ai.calls[0].fail(new Error('x'))
    await flush()
    expect(onFallback).toHaveBeenCalledWith(expect.any(Error), false)
    expect(last().status).toBe('idle')
  })

  test('lượt phát cũ bị bỏ qua khi đã bắt đầu lượt mới', async () => {
    let release: (c: SpeechChapter) => void = () => {}
    const { session, device, last } = setup({
      loadChapter: (_slug, n) =>
        n === 1 ? new Promise((r) => (release = r)) : Promise.resolve(chapters[n]),
    })
    session.start('truyen', 1)
    session.start('truyen', 2)
    await flush()
    release(chapters[1])
    await flush()
    expect(device.calls.map((c) => c.job.chapter)).toEqual([2])
    expect(last().chapter).toBe(2)
  })
})
