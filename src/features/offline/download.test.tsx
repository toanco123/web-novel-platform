import { act, screen, within } from '@testing-library/react'
import { getChapterRange } from '@/features/chapters/api'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { cancelDownload, downloadChapters, useDownloads } from './downloads'
import { getSavedChapter, listSavedStories, savedChapterList } from './store'

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
afterEach(() => vi.restoreAllMocks())

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

test('hủy giữa chừng giữ chương đã tải; tải lại chỉ lấy phần còn thiếu', async () => {
  vi.mocked(getChapterRange).mockImplementationOnce(async (...args) => {
    const chapters = await actual.getChapterRange(...args)
    cancelDownload(slug)
    return chapters
  })
  await downloadChapters({ slug, title, from: 1, total: 50 })
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
