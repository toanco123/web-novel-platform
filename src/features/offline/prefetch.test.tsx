import { act, cleanup, screen } from '@testing-library/react'
import { getChapterRange } from '@/features/chapters/api'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getSavedChapter } from './store'

vi.mock('@/features/chapters/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/chapters/api')>()
  return { ...api, getChapterRange: vi.fn(api.getChapterRange) }
})

const slug = 'truong-an-khong-tuyet'
const base = `/story/${slug}`
const heading = () => screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
  vi.mocked(getChapterRange).mockClear()
})

test('mở chương thì 5 chương sau vào kho; mất mạng vẫn đọc tiếp được', async () => {
  const { router, user } = renderApp(`${base}/chapter-12`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, 17), { timeout: 3000 }).not.toBeNull()
  expect(await getSavedChapter(slug, 18)).toBeNull()

  goOffline()
  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chapter-13`)
  expect(
    await screen.findByRole('link', { name: /Đọc tiếp chương 14/ }, { timeout: 3000 }),
  ).toBeInTheDocument()

  await act(() => router.navigate(`${base}/chapter-18`))
  expect(
    await screen.findByText('Chương 18 chưa được lưu để đọc offline.', undefined, {
      timeout: 3000,
    }),
  ).toBeInTheDocument()
})

test('chương đã có trong máy thì không tải lại', async () => {
  renderApp(`${base}/chapter-12`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, 17), { timeout: 3000 }).not.toBeNull()
  cleanup()
  vi.mocked(getChapterRange).mockClear()

  renderApp(`${base}/chapter-13`)
  await heading()
  await expect
    .poll(() => vi.mocked(getChapterRange).mock.calls, { timeout: 3000 })
    .toEqual([[slug, 18, 1]])
})

test('máy bật tiết kiệm dữ liệu thì không tải trước', async () => {
  Object.defineProperty(navigator, 'connection', {
    value: { saveData: true },
    configurable: true,
  })
  try {
    renderApp(`${base}/chapter-12`)
    await heading()
    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(getChapterRange).not.toHaveBeenCalled()
  } finally {
    delete (navigator as { connection?: unknown }).connection
  }
})
