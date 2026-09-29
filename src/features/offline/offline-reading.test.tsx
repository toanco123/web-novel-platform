import { cleanup, screen } from '@testing-library/react'
import { getChapter } from '@/features/chapters/api'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { getStory } from '@/features/stories/api'
import * as studio from '@/features/studio/api'
import { registerUser } from '@/test/helpers'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getSavedChapter, listSavedStories } from './store'

// Bọc getChapter để từng test giả lỗi mạng hoặc bản mới trên máy chủ
vi.mock('@/features/chapters/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/chapters/api')>()
  return { ...api, getChapter: vi.fn(api.getChapter) }
})
vi.mock('@/features/stories/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/stories/api')>()
  return { ...api, getStory: vi.fn(api.getStory) }
})
const actual =
  await vi.importActual<typeof import('@/features/chapters/api')>('@/features/chapters/api')
const actualStories =
  await vi.importActual<typeof import('@/features/stories/api')>('@/features/stories/api')

const slug = 'truong-an-khong-tuyet' // 412 chương
const base = `/story/${slug}`
const heading = () => screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
  vi.mocked(getChapter).mockImplementation(actual.getChapter)
  vi.mocked(getStory).mockImplementation(actualStories.getStory)
})

afterEach(() => vi.restoreAllMocks())

/** Mở chương khi có mạng cho chương vào kho, rồi đóng trang */
async function openOnce(number: number) {
  renderApp(`${base}/chapter-${number}`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, number), { timeout: 3000 }).not.toBeNull()
  cleanup()
}

test('chương đã mở được lưu; mất mạng mở lại vẫn đọc được, không gọi mạng', async () => {
  await openOnce(12)
  goOffline()
  vi.mocked(getChapter).mockClear()
  renderApp(`${base}/chapter-12`)
  await heading()
  expect(screen.getAllByText('Chương 12').length).toBeGreaterThan(0)
  expect(getChapter).not.toHaveBeenCalled()
})

test('mất mạng, chương chưa lưu: báo chưa lưu, có link tới truyện đã lưu', async () => {
  goOffline()
  renderApp(`${base}/chapter-30`)
  expect(
    await screen.findByText('Chương 30 chưa được lưu để đọc offline.', undefined, {
      timeout: 3000,
    }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Truyện đã lưu' })).toHaveAttribute(
    'href',
    '/library?tab=saved',
  )
})

test('máy báo có mạng nhưng tải lỗi mạng: cũng báo chưa lưu', async () => {
  vi.mocked(getChapter).mockRejectedValue(new TypeError('Failed to fetch'))
  renderApp(`${base}/chapter-30`)
  expect(
    await screen.findByText('Chương 30 chưa được lưu để đọc offline.', undefined, {
      timeout: 3000,
    }),
  ).toBeInTheDocument()
})

test('bản lưu cũ: hiện ngay rồi cập nhật theo bản mới trên máy chủ', async () => {
  await openOnce(12)
  vi.mocked(getChapter).mockImplementation(async (s, n) => {
    const chapter = await actual.getChapter(s, n)
    return chapter && n === 12 ? { ...chapter, content: '<p>Bản đã sửa của tác giả.</p>' } : chapter
  })
  renderApp(`${base}/chapter-12`)
  expect(
    await screen.findByText('Bản đã sửa của tác giả.', undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
  await expect
    .poll(async () => (await getSavedChapter(slug, 12))?.content)
    .toBe('<p>Bản đã sửa của tác giả.</p>')
})

test('chương không còn trên máy chủ: xóa bản lưu, trang báo không tìm thấy', async () => {
  await openOnce(12)
  vi.mocked(getChapter).mockImplementation(async (s, n) =>
    n === 12 ? null : actual.getChapter(s, n),
  )
  renderApp(`${base}/chapter-12`)
  expect(
    await screen.findByText(/Không tìm thấy chương 12/, undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
  await expect.poll(() => getSavedChapter(slug, 12)).toBeNull()
})

test('mở chương thì bản lưu ghi "đã đọc" (tab Đã lưu đọc tiếp đúng chương)', async () => {
  const { user, router } = renderApp(`${base}/chapter-12`)
  await heading()
  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chapter-13`)
  await expect
    .poll(async () => (await listSavedStories())[0]?.resume.number, { timeout: 3000 })
    .toBe(13)
})

test('truyện bị gỡ/ẩn: xóa mọi chương đã lưu của truyện, không chỉ chương đang mở', async () => {
  await openOnce(12)
  await openOnce(20)
  vi.mocked(getChapter).mockResolvedValue(null)
  vi.mocked(getStory).mockResolvedValue(null)
  renderApp(`${base}/chapter-12`)
  expect(
    await screen.findByText(/Không tìm thấy chương 12/, undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
  await expect.poll(() => listSavedStories()).toEqual([])
})

test('chương không còn trên máy chủ mà xóa bản lưu lỗi: trang vẫn báo không tìm thấy', async () => {
  await openOnce(12)
  vi.mocked(getChapter).mockResolvedValue(null)
  vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
    throw new DOMException('Lỗi ghi', 'UnknownError')
  })
  renderApp(`${base}/chapter-12`)
  expect(
    await screen.findByText(/Không tìm thấy chương 12/, undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
})

test('chủ truyện đọc truyện chưa công khai: không lưu vào kho chung của máy', async () => {
  await registerUser()
  const story = await studio.createStory({
    title: 'Truyện Nháp',
    description: 'Một câu chuyện còn đang viết dở, chưa công khai.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  await studio.saveChapter(
    story.id,
    { title: 'Mở đầu', content: 'Nội dung chương. '.repeat(20) },
    { publish: true },
  )
  renderApp(`/story/${story.slug}/chapter-1`)
  expect(await heading()).toHaveTextContent('Mở đầu')
  expect(await getSavedChapter(story.slug, 1)).toBeNull()
})

test('truyện đã lưu nay bị chủ truyện ẩn: bản lưu bị xóa, chủ truyện vẫn đọc được', async () => {
  await openOnce(12)
  vi.mocked(getChapter).mockImplementation(async (s, n) => {
    const chapter = await actual.getChapter(s, n)
    return chapter && { ...chapter, story: { ...chapter.story, visibility: 'draft' } }
  })
  renderApp(`${base}/chapter-12`)
  await heading()
  await expect.poll(() => listSavedStories()).toEqual([])
  expect(screen.getAllByText('Chương 12').length).toBeGreaterThan(0)
})
