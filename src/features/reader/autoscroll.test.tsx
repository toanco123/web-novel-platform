import { act, screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'
import { useAutoScrollSettings } from './autoscroll/useAutoScrollSettings'
import { useSpeechSettings } from './speech/useSpeechSettings'
import { READER_DEFAULTS, useReaderSettings } from './useReaderSettings'

const slow = { timeout: 3000 }
const base = '/truyen/truong-an-khong-tuyet'

// requestAnimationFrame giả: khung hình chỉ chạy khi test gọi runFrames
let now = 0
let nextId = 0
const frames = new Map<number, FrameRequestCallback>()
function runFrames(count: number) {
  for (let i = 0; i < count; i++) {
    now += 50
    const batch = [...frames.values()]
    frames.clear()
    act(() => batch.forEach((cb) => cb(now)))
  }
}

const scrollTo = vi.fn<(options?: ScrollToOptions | number, y?: number) => void>()

/** Vị trí các lần tự cuộn gọi window.scrollTo (bỏ qua lần cuộn về đầu trang khi chuyển chương) */
const autoScrollTops = () =>
  scrollTo.mock.calls
    .map(([options]) => options)
    .filter((o): o is ScrollToOptions => typeof o === 'object' && o.behavior === 'instant')
    .map((o) => o.top!)

/** Có "chỗ để cuộn": đoạn văn nằm dưới màn hình (jsdom không có bố cục, mọi thứ cao 0) */
function withRoomToScroll() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const bottom = this.hasAttribute('data-paragraph') ? 5000 : 0
    return { top: 0, bottom, left: 0, right: 0, width: 0, height: bottom, x: 0, y: 0 } as DOMRect
  })
}

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
  useAutoScrollSettings.setState({ speed: 1 })
  frames.clear()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++nextId, cb)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  scrollTo.mockClear()
  vi.stubGlobal('scrollTo', scrollTo)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('bấm Tự động cuộn: trang tự trôi xuống, chỉnh được tốc độ, tạm dừng và tắt được', async () => {
  withRoomToScroll()
  const { user } = renderApp(`${base}/chuong-12`)
  await screen.findByRole('heading', { level: 1 }, slow)
  await user.click(screen.getByRole('button', { name: 'Tự động cuộn' }))
  const bar = await screen.findByRole('region', { name: 'Tự động cuộn' })
  expect(screen.getByRole('button', { name: 'Tự động cuộn' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  runFrames(6)
  const tops = autoScrollTops()
  expect(tops.length).toBeGreaterThan(3)
  expect(tops.at(-1)!).toBeGreaterThan(tops[0])

  // Tốc độ đổi ngay và được nhớ cho lần đọc sau
  await user.click(within(bar).getByRole('button', { name: 'Nhanh hơn' }))
  expect(within(bar).getByText('1,25×')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('reader-autoscroll')!).state.speed).toBe(1.25)

  await user.click(within(bar).getByRole('button', { name: 'Tạm dừng' }))
  scrollTo.mockClear()
  runFrames(6)
  expect(autoScrollTops()).toEqual([])
  expect(within(bar).getByRole('button', { name: 'Cuộn tiếp' })).toBeInTheDocument()

  await user.click(within(bar).getByRole('button', { name: 'Tắt tự động cuộn' }))
  expect(screen.queryByRole('region', { name: 'Tự động cuộn' })).toBeNull()
})

test('hết chương thì dừng, bấm "Chương sau" để sang chương sau và cuộn tiếp', async () => {
  const { router, user } = renderApp(`${base}/chuong-12`)
  await screen.findByRole('heading', { level: 1 }, slow)
  await user.click(screen.getByRole('button', { name: 'Tự động cuộn' }))
  // Bố cục jsdom cao 0 nên đoạn cuối đã nằm trên thanh nổi: coi như hết chương
  runFrames(2)
  const bar = screen.getByRole('region', { name: 'Tự động cuộn' })
  expect(within(bar).getByText('Hết chương 12')).toBeInTheDocument()

  await user.click(within(bar).getByRole('button', { name: /Chương sau/ }))
  await expect.poll(() => router.state.location.pathname, slow).toBe(`${base}/chuong-13`)
  const next = await screen.findByRole('region', { name: 'Tự động cuộn' }, slow)
  expect(within(next).getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument()
})

test('tự chuyển chương bằng phím → khi đang tự cuộn thì tạm dừng', async () => {
  withRoomToScroll()
  const { router, user } = renderApp(`${base}/chuong-12`)
  await screen.findByRole('heading', { level: 1 }, slow)
  await user.click(screen.getByRole('button', { name: 'Tự động cuộn' }))
  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname, slow).toBe(`${base}/chuong-13`)
  const bar = await screen.findByRole('region', { name: 'Tự động cuộn' }, slow)
  await waitFor(() =>
    expect(within(bar).getByRole('button', { name: 'Cuộn tiếp' })).toBeInTheDocument(),
  )
})

test('nghe truyện và tự động cuộn không chạy cùng lúc', async () => {
  const synth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      constructor(text: string) {
        this.text = text
      }
    },
  )
  useSpeechSettings.setState({ rate: 1, autoNext: true, voiceURI: null })
  withRoomToScroll()
  const { user } = renderApp(`${base}/chuong-12`)
  await screen.findByRole('heading', { level: 1 }, slow)

  await user.click(screen.getByRole('button', { name: 'Nghe truyện' }))
  expect(await screen.findByRole('region', { name: 'Nghe truyện' })).toBeInTheDocument()

  // Bật tự cuộn thì tắt nghe
  await user.click(screen.getByRole('button', { name: 'Tự động cuộn' }))
  expect(screen.getByRole('region', { name: 'Tự động cuộn' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Nghe truyện' })).toBeNull()
  expect(synth.cancel).toHaveBeenCalled()

  // Bật nghe thì tắt tự cuộn
  await user.click(screen.getByRole('button', { name: 'Nghe truyện' }))
  expect(await screen.findByRole('region', { name: 'Nghe truyện' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Tự động cuộn' })).toBeNull()
})
