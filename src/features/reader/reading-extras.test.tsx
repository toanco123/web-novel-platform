import { screen, waitFor, within } from '@testing-library/react'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'
import { useSpeechSettings } from './speech/useSpeechSettings'
import { READER_DEFAULTS, useReaderSettings } from './useReaderSettings'

const slow = { timeout: 3000 }
const base = '/truyen/truong-an-khong-tuyet'

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
})

test('đọc chương → trang chủ có "Đọc tiếp" → bấm là mở lại đúng chương', async () => {
  const { router, user } = renderApp(`${base}/chuong-12`)
  await screen.findByRole('heading', { level: 1 }, slow)
  // Lịch sử được ghi ngay khi mở chương (khách cũng có)
  await expect
    .poll(() => JSON.parse(localStorage.getItem('mock-history') ?? '{}').guest?.[0]?.chapter, slow)
    .toBe(12)

  await router.navigate('/')
  const section = (await screen.findByRole('heading', { name: 'Đọc tiếp' }, slow)).closest(
    'section',
  )!
  await user.click(within(section).getByRole('link', { name: /Trường An Không Tuyết/ }))
  await expect.poll(() => router.state.location.pathname, slow).toBe(`${base}/chuong-12`)
})

test('trang truyện đã đọc dở: nút chính là "Đọc tiếp chương N", danh sách gắn nhãn', async () => {
  localStorage.setItem(
    'mock-history',
    JSON.stringify({
      guest: [
        {
          slug: 'truong-an-khong-tuyet',
          chapter: 3,
          chapterTitle: 'x',
          progress: 0.4,
          readAt: new Date().toISOString(),
        },
      ],
    }),
  )
  renderApp(base)
  expect(await screen.findByRole('link', { name: 'Đọc tiếp chương 3' }, slow)).toHaveAttribute(
    'href',
    `${base}/chuong-3`,
  )
  expect(screen.getByRole('link', { name: 'Đọc từ đầu' })).toHaveAttribute(
    'href',
    `${base}/chuong-1`,
  )
  expect(await screen.findByText('Đang đọc', {}, slow)).toBeInTheDocument()
})

test('bình luận chương: đăng nhập rồi gửi, chỉ hiện ở chương đó', async () => {
  signInAs('demo')
  const { user } = renderApp(`${base}/chuong-5`)
  const section = (
    await screen.findByRole('heading', { name: /Bình luận chương 5/ }, slow)
  ).closest('section')!
  await user.type(within(section).getByLabelText('Viết bình luận'), 'Chương 5 hay quá')
  await user.click(within(section).getByRole('button', { name: 'Gửi bình luận' }))
  const list = await within(section).findByRole('list', { name: 'Bình luận chương 5' }, slow)
  expect(await within(list).findByText('Chương 5 hay quá', {}, slow)).toBeInTheDocument()
})

test('báo lỗi chương → tác giả thấy trong tab Báo lỗi', async () => {
  signInAs('demo')
  const story = await publishStory('Mùa Hạ Năm Ấy', 2)
  signInAs(await registerUser())

  const { router, user } = renderApp(`/truyen/${story.slug}/chuong-2`)
  await user.click(await screen.findByRole('button', { name: 'Báo lỗi chương' }, slow))
  const dialog = await screen.findByRole('dialog', { name: 'Báo lỗi chương 2' }, slow)
  await user.click(within(dialog).getByRole('radio', { name: 'Lỗi khác' }))
  await user.click(within(dialog).getByRole('button', { name: 'Gửi báo lỗi' }))
  // "Lỗi khác" bắt buộc ghi chú
  expect(await within(dialog).findByText('Mô tả ngắn lỗi bạn gặp')).toBeInTheDocument()
  await user.type(within(dialog).getByLabelText(/Ghi chú/), 'Thiếu đoạn cuối')
  await user.click(within(dialog).getByRole('button', { name: 'Gửi báo lỗi' }))
  expect(await screen.findByRole('heading', { name: 'Đã gửi báo lỗi' }, slow)).toBeInTheDocument()

  signInAs('demo')
  await router.navigate(`/sang-tac/truyen/${story.id}`)
  await user.click(await screen.findByRole('tab', { name: /Báo lỗi/ }, slow))
  const list = await screen.findByRole('list', { name: 'Báo lỗi chương' }, slow)
  expect(within(list).getByText('Thiếu đoạn cuối')).toBeInTheDocument()
  await user.click(within(list).getByRole('button', { name: 'Đã xử lý' }))
  expect(await within(list).findByRole('button', { name: 'Mở lại' }, slow)).toBeInTheDocument()
})

test('cuộn liên tục: chương sau được nối vào bên dưới', async () => {
  useReaderSettings.setState({ continuous: true })
  const { user } = renderApp(`${base}/chuong-1`)
  await screen.findByRole('heading', { level: 1 }, slow)
  await user.click(await screen.findByRole('button', { name: 'Tải chương 2' }, slow))
  await waitFor(
    () => expect(document.querySelector('article[data-chapter="2"] h2')).not.toBeNull(),
    slow,
  )
  // Giữa hai chương có dải "Hết chương 1" và nút mở bình luận thu gọn
  expect(screen.getByText('Hết chương 1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Bình luận chương 1/ })).toBeInTheDocument()
})

describe('nghe truyện', () => {
  class FakeUtterance {
    text: string
    lang = ''
    rate = 1
    voice: unknown = null
    onend: (() => void) | null = null
    onerror: ((e: { error: string }) => void) | null = null
    constructor(text: string) {
      this.text = text
    }
  }
  const spoken: FakeUtterance[] = []
  const synth = {
    speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
    cancel: vi.fn(),
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  }

  beforeEach(() => {
    spoken.length = 0
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    useSpeechSettings.setState({ rate: 1, autoNext: true, voiceURI: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  test('bấm Nghe: đọc tên chương rồi từng đoạn, tô đoạn đang đọc, tạm dừng và tắt được', async () => {
    const { user } = renderApp(`${base}/chuong-12`)
    await screen.findByRole('heading', { level: 1 }, slow)
    await user.click(screen.getByRole('button', { name: 'Nghe truyện' }))

    await waitFor(() => expect(spoken.length).toBe(1), slow)
    expect(spoken[0].text).toMatch(/^Chương 12\./)
    expect(spoken[0].lang).toBe('vi-VN')
    const bar = await screen.findByRole('region', { name: 'Nghe truyện' })
    expect(bar).toHaveTextContent(/đoạn 1\//)
    expect(document.querySelector('[data-paragraph="0"]')).toHaveClass('bg-primary/10')

    // Đọc xong câu thì sang câu sau
    spoken[0].onend!()
    expect(spoken.length).toBe(2)

    await user.click(within(bar).getByRole('button', { name: 'Tạm dừng' }))
    expect(synth.cancel).toHaveBeenCalled()
    expect(within(bar).getByRole('button', { name: 'Nghe tiếp' })).toBeInTheDocument()

    await user.click(within(bar).getByRole('button', { name: 'Tắt nghe truyện' }))
    expect(screen.queryByRole('region', { name: 'Nghe truyện' })).toBeNull()
  })

  test('trình duyệt không hỗ trợ thì không có nút Nghe', async () => {
    vi.unstubAllGlobals()
    renderApp(`${base}/chuong-12`)
    await screen.findByRole('heading', { level: 1 }, slow)
    expect(screen.queryByRole('button', { name: 'Nghe truyện' })).toBeNull()
  })
})
