import { screen, waitFor, within } from '@testing-library/react'
import { ttsMock } from '@/mocks/tts'
import { registerUser } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'
import { SILENT_AUDIO } from './speech/silentAudio'
import { useSpeechSettings } from './speech/useSpeechSettings'
import { READER_DEFAULTS, useReaderSettings } from './useReaderSettings'

const slow = { timeout: 3000 }
const chapter = '/story/truong-an-khong-tuyet/chapter-12'

// Giọng của máy giả (để xem lúc Giọng AI lỗi có đọc tiếp không)
const spoken: { text: string }[] = []
const synth = {
  speak: vi.fn((u: { text: string }) => spoken.push(u)),
  cancel: vi.fn(),
  getVoices: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
}
class FakeUtterance {
  text: string
  constructor(text: string) {
    this.text = text
  }
}

// <audio> của jsdom không phát được: ghi lại địa chỉ được phát, test tự báo "phát xong"
const played: string[] = []
let playSpy: { mock: { contexts: unknown[] } }

beforeEach(() => {
  localStorage.clear()
  ttsMock.reset()
  spoken.length = 0
  played.length = 0
  useReaderSettings.setState(READER_DEFAULTS)
  useSpeechSettings.setState({ rate: 1, autoNext: true, voiceURI: null, aiVoice: null })
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(this.src)
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Phần tử <audio> vừa được gọi play() báo đã phát xong */
const finishClip = () =>
  (playSpy.mock.contexts.at(-1) as HTMLMediaElement).dispatchEvent(new Event('ended'))

async function openSettings(user: ReturnType<typeof renderApp>['user']) {
  await screen.findByRole('heading', { level: 1 }, slow)
  await user.click(screen.getByRole('button', { name: 'Cài đặt đọc' }))
  return screen.findByRole('dialog', { name: 'Cài đặt đọc' })
}

test('khách: Giọng AI bị khóa, có lời mời đăng nhập', async () => {
  const { user } = renderApp(chapter)
  const dialog = await openSettings(user)
  expect(within(dialog).getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
    'href',
    expect.stringContaining('/login'),
  )
  await user.click(within(dialog).getByRole('combobox', { name: 'Giọng đọc' }))
  expect(await screen.findByRole('option', { name: 'Giọng nữ 1' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
})

test('đăng nhập, chọn Giọng AI: đọc tên chương rồi từng đoạn bằng file âm thanh', async () => {
  await registerUser()
  const { user } = renderApp(chapter)
  const dialog = await openSettings(user)
  await user.click(within(dialog).getByRole('combobox', { name: 'Giọng đọc' }))
  await user.click(await screen.findByRole('option', { name: 'Giọng nữ 1' }))
  expect(useSpeechSettings.getState().aiVoice).toBe('Aoede')
  await user.keyboard('{Escape}')

  await user.click(screen.getByRole('button', { name: 'Nghe truyện' }))
  // Phát clip im lặng ngay lúc bấm (mở khóa âm thanh), rồi tên chương
  await waitFor(() => expect(played).toHaveLength(2), slow)
  expect(played[0]).toBe(SILENT_AUDIO)
  expect(ttsMock.requests[0]).toMatchObject({
    slug: 'truong-an-khong-tuyet',
    chapter: 12,
    voice: 'Aoede',
    generate: [0, 1, 2, 3],
    title: true,
  })
  const bar = await screen.findByRole('region', { name: 'Nghe truyện' })
  expect(bar).toHaveTextContent(/đoạn 1\//)
  expect(document.querySelector('[data-paragraph="0"]')).toHaveClass('bg-primary/10')

  finishClip() // tên chương
  await waitFor(() => expect(played).toHaveLength(3), slow)
  finishClip() // đoạn 1
  await waitFor(() => expect(bar).toHaveTextContent(/đoạn 2\//), slow)
  expect(document.querySelector('[data-paragraph="1"]')).toHaveClass('bg-primary/10')
  expect(synth.speak).not.toHaveBeenCalled()
})

test('Giọng AI hết lượt: báo và đọc tiếp bằng giọng của máy từ đúng đoạn đó', async () => {
  await registerUser()
  useSpeechSettings.setState({ aiVoice: 'Aoede' })
  ttsMock.fail = 'tts_daily_quota'
  const { user } = renderApp(chapter)
  await screen.findByRole('heading', { level: 1 }, slow)
  await user.click(screen.getByRole('button', { name: 'Nghe truyện' }))

  expect(
    await screen.findByText(
      'Bạn đã dùng hết lượt Giọng AI hôm nay. Đang đọc tiếp bằng giọng của máy.',
      {},
      slow,
    ),
  ).toBeInTheDocument()
  await waitFor(() => expect(spoken.length).toBe(1), slow)
  expect(spoken[0].text).toMatch(/^Chương 12\./)
})
