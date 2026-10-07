import { act, cleanup, screen, within } from '@testing-library/react'
import { getChapter, getChapterRange } from '@/features/chapters/api'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import * as studio from '@/features/studio/api'
import { registerUser } from '@/test/helpers'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getSavedChapter } from './store'

vi.mock('@/features/chapters/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/chapters/api')>()
  return {
    ...api,
    getChapter: vi.fn(api.getChapter),
    getChapterRange: vi.fn(api.getChapterRange),
  }
})

const slug = 'truong-an-khong-tuyet'
const base = `/story/${slug}`
const heading = () => screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
  vi.mocked(getChapterRange).mockClear()
  vi.mocked(getChapter).mockClear()
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

test('truyện chưa công khai (chủ truyện xem trước) thì không tải trước', async () => {
  await registerUser()
  const story = await studio.createStory({
    title: 'Truyện Nháp',
    description: 'Một câu chuyện còn đang viết dở, chưa công khai.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  for (const title of ['Mở đầu', 'Gặp gỡ']) {
    const chapter = { title, content: 'Nội dung chương. '.repeat(20) }
    await studio.saveChapter(story.id, chapter, { publish: true })
  }
  renderApp(`/story/${story.slug}/chapter-1`)
  await heading()
  await new Promise((resolve) => setTimeout(resolve, 800))
  expect(getChapterRange).not.toHaveBeenCalled()
})

test('chương trước vào cache; rê chuột vào link "Chương sau" thì tải trước chương đó', async () => {
  // Không cho tải trước theo lô để chương sau chưa có trong cache
  vi.mocked(getChapterRange).mockResolvedValueOnce([])
  const { user } = renderApp(`${base}/chapter-12`)
  await heading()
  await expect
    .poll(() => vi.mocked(getChapter).mock.calls, { timeout: 3000 })
    .toContainEqual([slug, 11])
  expect(getChapter).not.toHaveBeenCalledWith(slug, 13)

  const [top] = screen.getAllByRole('navigation', { name: /Chuyển chương/ })
  await user.hover(within(top).getByRole('link', { name: /Chương sau|Sau/ }))
  await expect.poll(() => vi.mocked(getChapter).mock.calls).toContainEqual([slug, 13])
})
