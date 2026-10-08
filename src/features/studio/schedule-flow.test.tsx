// Hẹn giờ đăng chương trên giao diện Sáng tác: hẹn từ trình soạn, xếp lịch nhiều chương
import { cleanup, screen, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'
import { publishStory, signInAs, signOut } from '@/test/helpers'
import * as studio from './api'

const slow = { timeout: 4000 }
const content = 'Mùa hạ năm ấy, lớp mười một chuyển chỗ ngồi. '.repeat(5)

beforeEach(() => {
  localStorage.clear()
  signInAs('demo')
})

/** Truyện công khai có chương 1, cộng các chương nháp `drafts` */
async function storyWithDrafts(drafts: number[]) {
  const story = await publishStory('Truyện Hẹn Giờ', 1)
  for (const number of drafts) {
    await studio.saveChapter(story.id, {
      title: `Chương nháp ${number}`,
      content,
      newNumber: number,
    })
  }
  return story
}

test('hẹn giờ từ trình soạn: lưu xong về trang quản lý, chương hiện huy hiệu giờ hẹn', async () => {
  const story = await storyWithDrafts([2])
  const { router, user } = renderApp(`/studio/story/${story.id}/chapter/2`)

  await user.click(await screen.findByRole('button', { name: 'Hẹn giờ' }, slow))
  const dialog = await screen.findByRole('dialog', { name: 'Hẹn giờ đăng chương' }, slow)
  // Mặc định 20:00 ngày mai
  expect(within(dialog).getByLabelText('Giờ đăng')).toHaveValue('20:00')
  expect(within(dialog).getByText(/Chương sẽ tự xuất bản lúc 20:00 ngày mai/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Lưu và hẹn giờ' }))

  await expect.poll(() => router.state.location.pathname, slow).toBe(`/studio/story/${story.id}`)
  const list = await screen.findByRole('list', { name: 'Danh sách chương' }, slow)
  expect(await within(list).findAllByText(/^Hẹn 20:00 · /, {}, slow)).not.toHaveLength(0)
  expect((await studio.getMyChapter(story.id, 2))?.scheduledAt).not.toBeNull()
})

test('giờ hẹn đã qua thì báo lỗi ngay trong hộp hẹn giờ, không lưu', async () => {
  const story = await storyWithDrafts([2])
  const { user } = renderApp(`/studio/story/${story.id}/chapter/2`)

  await user.click(await screen.findByRole('button', { name: 'Hẹn giờ' }, slow))
  const dialog = await screen.findByRole('dialog', { name: 'Hẹn giờ đăng chương' }, slow)
  const date = within(dialog).getByLabelText('Ngày đăng')
  await user.clear(date)
  await user.type(date, '2020-01-01')
  await user.click(within(dialog).getByRole('button', { name: 'Lưu và hẹn giờ' }))
  expect(
    await within(dialog).findByText('Chọn giờ sau hiện tại ít nhất 1 phút.', {}, slow),
  ).toBeInTheDocument()
  expect((await studio.getMyChapter(story.id, 2))?.scheduledAt).toBeNull()
})

test('xếp lịch 3 chương nháp mỗi ngày: xem trước đúng thứ tự rồi lưu', async () => {
  const story = await storyWithDrafts([2, 3, 4])
  const { user } = renderApp(`/studio/story/${story.id}`)

  await user.click(await screen.findByRole('button', { name: 'Xếp lịch' }, slow))
  const dialog = await screen.findByRole('dialog', { name: 'Xếp lịch đăng chương' }, slow)
  const preview = within(dialog).getByRole('list', { name: 'Lịch dự kiến' })
  const items = within(preview).getAllByRole('listitem')
  expect(items.map((li) => li.textContent)).toEqual([
    expect.stringMatching(/^Chương 2.*20:00 ngày mai/),
    expect.stringMatching(/^Chương 3.*20:00/),
    expect.stringMatching(/^Chương 4.*20:00/),
  ])

  // Mỗi lần 2 chương: chương 2 và 3 cùng giờ
  await user.click(within(dialog).getByRole('radio', { name: '2' }))
  const paired = within(within(dialog).getByRole('list', { name: 'Lịch dự kiến' })).getAllByRole(
    'listitem',
  )
  expect(paired[0].textContent?.replace('Chương 2', '')).toBe(
    paired[1].textContent?.replace('Chương 3', ''),
  )

  await user.click(within(dialog).getByRole('button', { name: 'Lưu lịch (3 chương)' }))
  expect(await screen.findByText('Đã xếp lịch 3 chương.', {}, slow)).toBeInTheDocument()
  const chapters = await studio.getMyChapters(story.id)
  expect(chapters.map((c) => c.scheduledAt !== null)).toEqual([false, true, true, true])
  expect(chapters[1].scheduledAt).toBe(chapters[2].scheduledAt)
})

test('hủy hẹn giờ từ menu của chương', async () => {
  const story = await storyWithDrafts([2])
  await studio.setChapterSchedule(story.id, 2, new Date(Date.now() + 5 * 3_600_000).toISOString())
  const { user } = renderApp(`/studio/story/${story.id}`)

  await user.click(await screen.findByRole('button', { name: 'Thao tác khác cho chương 2' }, slow))
  await user.click(await screen.findByRole('menuitem', { name: 'Hủy hẹn giờ' }, slow))
  await expect
    .poll(async () => (await studio.getMyChapter(story.id, 2))?.scheduledAt, slow)
    .toBeNull()
})

test('người đọc thấy "Chương … ra lúc …" ở trang truyện và cuối chương mới nhất; tới giờ thì chương hiện ra', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    vi.setSystemTime(new Date(2026, 9, 7, 10, 0))
    const story = await storyWithDrafts([2])
    await studio.setChapterSchedule(story.id, 2, new Date(2026, 9, 7, 20, 0).toISOString())
    signOut()

    renderApp(`/story/${story.slug}`)
    expect(await screen.findByText(/Chương 2 ra lúc/, {}, slow)).toHaveTextContent(
      'Chương 2 ra lúc 20:00 hôm nay',
    )
    cleanup()

    renderApp(`/story/${story.slug}/chapter-1`)
    const end = await screen.findByRole('region', { name: 'Hết chương' }, slow)
    expect(within(end).getByText(/Chương 2 ra lúc/)).toHaveTextContent('20:00 hôm nay')
    cleanup()

    // Qua giờ hẹn: chương 2 tự ra, không còn dòng "sắp ra"
    vi.setSystemTime(new Date(2026, 9, 7, 20, 1))
    renderApp(`/story/${story.slug}`)
    // (Khách đã đọc chương 1 nên nút đầu trang là "Đọc tiếp"; xem danh sách chương)
    expect(
      (await screen.findAllByRole('link', { name: /Chương nháp 2/ }, slow)).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/ra lúc/)).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
