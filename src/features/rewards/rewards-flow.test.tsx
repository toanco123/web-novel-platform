import { screen, within } from '@testing-library/react'
import { stories as seedStories } from '@/mocks/stories'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'
import { checkIn } from './api'

const slow = { timeout: 3000 }
const seed = seedStories[0]

/** Giờ máy giả theo giờ Việt Nam, 9 giờ sáng của ngày `day` */
const setDay = (day: string) => vi.setSystemTime(new Date(`${day}T09:00:00+07:00`))

/** Người dùng hiện tại điểm danh `count` ngày liền (từ 01/10/2026), rồi sang ngày `today` */
async function checkInDays(count: number, today: string) {
  for (let i = 1; i <= count; i++) {
    setDay(`2026-10-${String(i).padStart(2, '0')}`)
    await checkIn()
  }
  setDay(today)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  setDay('2026-10-01')
})
afterEach(() => vi.useRealTimers())

test('điểm danh từ header: nhận phiếu, ô hôm nay thành đã nhận, chấm báo biến mất', async () => {
  await registerUser()
  const { user } = renderApp('/')
  await user.click(
    await screen.findByRole(
      'button',
      { name: 'Điểm danh hằng ngày (chưa điểm danh hôm nay)' },
      slow,
    ),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Điểm danh hằng ngày' }, slow)
  expect(
    within(sheet).getByRole('listitem', { name: 'Ngày 1: hôm nay, chưa điểm danh' }),
  ).toBeVisible()

  await user.click(
    await within(sheet).findByRole('button', { name: 'Điểm danh nhận +1 phiếu' }, slow),
  )
  expect(
    await within(sheet).findByText('+1 phiếu đề cử. Hẹn bạn ngày mai nhé!', {}, slow),
  ).toBeInTheDocument()
  expect(
    within(sheet).getByRole('button', { name: 'Đã điểm danh, quay lại ngày mai' }),
  ).toBeDisabled()
  expect(within(sheet).getByRole('listitem', { name: 'Ngày 1: đã nhận' })).toBeVisible()
  // Sheet đang mở nên phần còn lại của trang bị ẩn khỏi cây trợ năng
  expect(
    screen.getByRole('button', { name: 'Điểm danh hằng ngày', hidden: true }),
  ).toBeInTheDocument()
})

test('ngày 7 của chuỗi được thưởng 3 phiếu', async () => {
  await registerUser()
  await checkInDays(6, '2026-10-07')
  const { user } = renderApp('/rewards')
  await user.click(await screen.findByRole('button', { name: 'Điểm danh nhận +3 phiếu' }, slow))
  expect(
    await screen.findByText('+3 phiếu: thưởng chuỗi 7 ngày! Mai bắt đầu chu kỳ mới.', {}, slow),
  ).toBeInTheDocument()
  expect(screen.getByText('Đã nhận quà chuỗi 7 ngày')).toBeInTheDocument()
})

test('trang /rewards: lịch sử phiếu có số dư; khách bị chuyển sang đăng nhập', async () => {
  await registerUser()
  await checkInDays(2, '2026-10-03')
  renderApp('/rewards')
  const table = await screen.findByRole('table', {}, slow)
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)
  expect(rows[0]).toHaveTextContent(/Điểm danh\s*\+1\s*2/)

  localStorage.removeItem('mock-auth-session')
  const guest = renderApp('/rewards')
  await expect.poll(() => guest.router.state.location.pathname, slow).toBe('/login')
})

test('đề cử truyện ở trang truyện rồi thấy trên bảng Đề cử', async () => {
  signInAs('demo')
  await checkInDays(5, '2026-10-06')
  const { user, router } = renderApp(`/story/${seed.slug}`)
  await user.click(await screen.findByRole('button', { name: /^Đề cử truyện/ }, slow))
  const dialog = await screen.findByRole('dialog', { name: 'Đề cử truyện' }, slow)
  expect(await within(dialog).findByText('Bạn có 5 phiếu', {}, slow)).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Thêm một phiếu' }))
  await user.click(within(dialog).getByRole('button', { name: 'Đề cử 2 phiếu' }))
  expect(await within(dialog).findByText('Đã đề cử 2 phiếu', {}, slow)).toBeInTheDocument()
  expect(within(dialog).getByText(/Bạn còn 3 phiếu/)).toBeInTheDocument()

  await user.click(within(dialog).getByRole('link', { name: 'Xem Đề cử tuần' }))
  await expect.poll(() => router.state.location.search, slow).toBe('?by=votes')
  // Danh sách xếp hạng là danh sách có aria-busy (header, footer cũng có danh sách)
  await expect
    .poll(
      () =>
        screen
          .getAllByRole('list')
          .find((l) => l.hasAttribute('aria-busy'))
          ?.textContent?.includes(seed.title),
      slow,
    )
    .toBe(true)
})

test('chưa có phiếu thì hộp đề cử mời đi điểm danh', async () => {
  signInAs('demo')
  const { user } = renderApp(`/story/${seed.slug}`)
  await user.click(await screen.findByRole('button', { name: /^Đề cử truyện/ }, slow))
  const dialog = await screen.findByRole('dialog', { name: 'Đề cử truyện' }, slow)
  expect(await within(dialog).findByText('Bạn chưa có phiếu', {}, slow)).toBeInTheDocument()
  expect(within(dialog).getByRole('link', { name: 'Đi điểm danh' })).toHaveAttribute(
    'href',
    '/rewards',
  )
})

test('khách bấm Đề cử thì sang đăng nhập', async () => {
  localStorage.removeItem('mock-auth-session')
  const guest = renderApp(`/story/${seed.slug}`)
  await guest.user.click(await screen.findByRole('button', { name: /^Đề cử truyện/ }, slow))
  await expect.poll(() => guest.router.state.location.pathname, slow).toBe('/login')
})

test('tác giả không thấy nút Đề cử ở truyện của mình', async () => {
  await registerUser()
  const story = await publishStory('Truyện Của Tôi', 1)
  renderApp(`/story/${story.slug}`)
  await screen.findByRole('heading', { name: 'Truyện Của Tôi', level: 1 }, slow)
  expect(screen.queryByRole('button', { name: /^Đề cử truyện/ })).toBeNull()
})

test('trang chủ: khối Đề cử tuần trống thì mời khách đăng nhập để điểm danh', async () => {
  localStorage.removeItem('mock-auth-session')
  renderApp('/')
  const section = await screen.findByRole('region', { name: 'Đề cử tuần' }, slow)
  expect(
    await within(section).findByText('Chưa có truyện nào được đề cử tuần này.', {}, slow),
  ).toBeInTheDocument()
  expect(within(section).getByRole('link', { name: 'Đăng nhập để điểm danh' })).toBeInTheDocument()
})
