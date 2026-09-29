import { act, screen, within } from '@testing-library/react'
import { getChapterRange } from '@/features/chapters/api'
import * as studio from '@/features/studio/api'
import { registerUser } from '@/test/helpers'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { cancelDownload, downloadChapters, useDownloads } from './downloads'
import { fakeChapter } from '@/test/offline'
import { prefetchFrom } from './prefetch'
import {
  getSavedChapter,
  listSavedStories,
  resetOfflineDatabase,
  saveChapters,
  savedChapterList,
} from './store'

vi.mock('@/features/chapters/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/chapters/api')>()
  return { ...api, getChapterRange: vi.fn(api.getChapterRange) }
})
const actual =
  await vi.importActual<typeof import('@/features/chapters/api')>('@/features/chapters/api')

const slug = 'truong-an-khong-tuyet' // 412 chương
const base = `/story/${slug}`
const title = 'Trường An'

beforeEach(() => {
  localStorage.clear()
  useDownloads.setState({ bySlug: {} })
  vi.mocked(getChapterRange).mockReset().mockImplementation(actual.getChapterRange)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('tải 20 chương từ trang truyện; mất mạng vẫn đọc được chương thứ 20', async () => {
  const { user, router } = renderApp(base)
  await user.click(
    await screen.findByRole('button', { name: 'Tải về đọc offline' }, { timeout: 3000 }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Tải về đọc offline' })
  await user.click(await within(dialog).findByRole('button', { name: '20 chương' }))
  expect(
    (await screen.findAllByText(/Đã tải 20 chương/, undefined, { timeout: 5000 })).length,
  ).toBeGreaterThan(0)
  expect(await getSavedChapter(slug, 20)).not.toBeNull()
  expect(await listSavedStories()).toMatchObject([{ pinned: true, numbers: expect.any(Array) }])

  goOffline()
  await act(() => router.navigate(`${base}/chapter-20`))
  expect(await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.getAllByText('Chương 20').length).toBeGreaterThan(0)
})

test('hủy giữa chừng: báo đã hủy ngay, đợt đang tải dở không lưu; tải lại chỉ lấy phần còn thiếu', async () => {
  let release = () => {}
  vi.mocked(getChapterRange)
    .mockImplementationOnce(actual.getChapterRange)
    .mockImplementationOnce(async (...args) => {
      // Đợt thứ hai chỉ trả về khi test cho phép (đang tải dở thì người đọc bấm hủy)
      await new Promise<void>((resolve) => (release = resolve))
      return actual.getChapterRange(...args)
    })
  const running = downloadChapters({ slug, title, from: 1, total: 50 })
  await expect.poll(() => vi.mocked(getChapterRange).mock.calls.length, { timeout: 3000 }).toBe(2)
  cancelDownload(slug)
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({ status: 'cancelled', done: 20 })
  release()
  await running
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({ status: 'cancelled', done: 20 })
  expect(await savedChapterList(slug)).toHaveLength(20)

  vi.mocked(getChapterRange).mockClear()
  await downloadChapters({ slug, title, from: 1, total: 50 })
  expect(vi.mocked(getChapterRange).mock.calls).toEqual([
    [slug, 21, 20],
    [slug, 41, 10],
  ])
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({
    status: 'done',
    done: 50,
    total: 50,
  })
})

test('hủy rồi bấm tải lại ngay khi đợt cũ chưa về: lượt mới vẫn chạy', async () => {
  let release = () => {}
  vi.mocked(getChapterRange).mockImplementationOnce(async (...args) => {
    await new Promise<void>((resolve) => (release = resolve))
    return actual.getChapterRange(...args)
  })
  const first = downloadChapters({ slug, title, from: 1, total: 20 })
  await expect.poll(() => vi.mocked(getChapterRange).mock.calls.length, { timeout: 3000 }).toBe(1)
  cancelDownload(slug)
  await downloadChapters({ slug, title, from: 1, total: 20 })
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({ status: 'done', done: 20 })
  release()
  await first
  // Lượt cũ về sau không ghi đè trạng thái của lượt mới
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({ status: 'done', done: 20 })
})

test('bộ nhớ đầy: dừng và báo đã tải được bao nhiêu chương', async () => {
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
    throw new DOMException('Hết chỗ', 'QuotaExceededError')
  })
  await downloadChapters({ slug, title, from: 1, total: 20 })
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({
    status: 'failed',
    done: 0,
    error: 'Bộ nhớ máy đầy, đã tải được 0 chương.',
  })
})

test('mục lục trang đọc có nút tải về, tải từ chương đang đọc', async () => {
  const { user } = renderApp(`${base}/chapter-12`)
  await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: 'Mục lục' }))
  const index = await screen.findByRole('dialog', { name: 'Mục lục' })
  await user.click(within(index).getByRole('button', { name: 'Tải về đọc offline' }))
  expect(
    await screen.findByText(/Tải từ chương 12\./, undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
})

test('chuỗi chương đã lưu dừng ở chương "mới nhất" cũ (truyện đã ra thêm): vẫn tải tiếp từ máy chủ', async () => {
  await saveChapters([10, 11, 12].map((n) => fakeChapter(slug, n, { last: 12 })))
  await downloadChapters({ slug, title, from: 10, total: 20 })
  expect(vi.mocked(getChapterRange).mock.calls).toEqual([[slug, 13, 17]])
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({ status: 'done', done: 20 })
  expect(await getSavedChapter(slug, 29)).not.toBeNull()
})

test('trình duyệt không cho lưu (không có IndexedDB): báo lỗi, không tải, không tải trước', async () => {
  await resetOfflineDatabase()
  vi.stubGlobal('indexedDB', undefined)
  await downloadChapters({ slug, title, from: 1, total: 20 })
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({
    status: 'failed',
    error: 'Trình duyệt này không cho lưu dữ liệu nên không tải về được.',
  })
  expect(await prefetchFrom(slug, 13)).toEqual([])
  expect(getChapterRange).not.toHaveBeenCalled()
  await resetOfflineDatabase()
})

test('truyện chưa công khai (chủ truyện xem trước): không có nút tải về', async () => {
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
  const { user, router } = renderApp(`/story/${story.slug}`)
  expect(
    await screen.findByRole('link', { name: 'Quản lý truyện' }, { timeout: 3000 }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tải về đọc offline' })).not.toBeInTheDocument()

  await act(() => router.navigate(`/story/${story.slug}/chapter-1`))
  await screen.findByRole('heading', { level: 1, name: /Mở đầu/ }, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: 'Mục lục' }))
  const index = await screen.findByRole('dialog', { name: 'Mục lục' })
  expect(within(index).queryByRole('button', { name: 'Tải về đọc offline' })).toBeNull()
})
