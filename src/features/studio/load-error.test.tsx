import { screen } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'
import { draftStory, registerUser } from '@/test/helpers'
import * as mock from './api.mock'

// Giả lập lỗi mạng: bọc hàm của bản giả để từng test cho nó ném lỗi một lần
vi.mock('./api.mock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api.mock')>()
  return {
    ...actual,
    getMyStory: vi.fn(actual.getMyStory),
    getMyChapters: vi.fn(actual.getMyChapters),
  }
})

const slow = { timeout: 4000 }
beforeEach(() => localStorage.clear())

test('trang quản lý truyện: lỗi mạng thì cho thử lại, không hiện trang 404', async () => {
  await registerUser()
  const story = await draftStory('Mùa Hạ Năm Ấy', 1)
  vi.mocked(mock.getMyStory).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const { user } = renderApp(`/studio/story/${story.id}`)

  expect(await screen.findByText(/Không tải được dữ liệu/, {}, slow)).toBeInTheDocument()
  expect(screen.queryByText('404')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Mùa Hạ Năm Ấy' }, slow),
  ).toBeInTheDocument()
})

test('trang quản lý truyện: truyện không có thì vẫn hiện 404', async () => {
  await registerUser()
  renderApp('/studio/story/khong-co-truyen-nay')
  expect(await screen.findByText(/Không tìm thấy truyện này/, {}, slow)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument()
})

test('trình soạn chương: lỗi mạng khi tải danh sách chương thì cho thử lại', async () => {
  await registerUser()
  const story = await draftStory('Mùa Hạ Năm Ấy', 1)
  vi.mocked(mock.getMyChapters).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const { user } = renderApp(`/studio/story/${story.id}/new-chapter`)

  expect(await screen.findByText(/Không tải được dữ liệu/, {}, slow)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByLabelText('Số chương', {}, slow)).toHaveValue(2)
})
