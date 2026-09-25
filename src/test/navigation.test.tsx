import { screen, within } from '@testing-library/react'
import { navItems } from '@/components/common/navItems'
import { paths } from '@/lib/routes'
import { renderApp } from './renderApp'
import { signInAs } from './helpers'

const slow = { timeout: 3000 }
beforeEach(() => localStorage.clear())

// Mọi đường dẫn có link trên menu, footer, menu tài khoản đều phải có trang thật
const linked = [
  ...navItems.map((i) => i.to).filter((to) => to !== paths.home),
  paths.latest,
  paths.search(),
  paths.library,
  paths.readingHistory,
  paths.account,
  paths.about,
  paths.contact,
  paths.terms,
  paths.privacy,
]

test.each(linked)('%s không còn là trang 404', async (path) => {
  signInAs('demo')
  renderApp(path)
  expect(await screen.findByRole('heading', { level: 1 }, slow)).toBeInTheDocument()
  expect(screen.queryByText('Trang bạn tìm không tồn tại.')).toBeNull()
})

test('danh sách không có thật thì báo 404', async () => {
  renderApp('/danh-sach/khong-co')
  expect(await screen.findByText('Không có danh sách truyện này.', {}, slow)).toBeInTheDocument()
})

test('gõ ở ô tìm kiếm header: gợi ý truyện, ↓ rồi Enter mở truyện', async () => {
  const { router, user } = renderApp('/')
  const box = await screen.findByRole('combobox', { name: 'Tìm truyện' }, slow)
  await user.type(box, 'truong an')
  const list = await screen.findByRole('listbox', { name: 'Gợi ý truyện' }, slow)
  expect(
    await within(list).findByRole('option', { name: /Trường An Không Tuyết/ }, slow),
  ).toBeInTheDocument()

  await user.keyboard('{ArrowDown}{Enter}')
  await expect
    .poll(() => router.state.location.pathname, slow)
    .toBe('/truyen/truong-an-khong-tuyet')
})

test('Enter không chọn gợi ý thì sang trang kết quả tìm kiếm', async () => {
  const { router, user } = renderApp('/')
  await user.type(
    await screen.findByRole('combobox', { name: 'Tìm truyện' }, slow),
    'mac ninh{Enter}',
  )
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/tim-kiem?q=mac%20ninh')
  const results = await screen.findByRole('list', { name: 'Kết quả tìm kiếm' }, slow)
  // Tìm theo tên tác giả Mặc Ninh (gõ không dấu)
  expect(within(results).getByRole('link', { name: 'Gió Thổi Qua Ngõ Nhỏ' })).toBeInTheDocument()
})

test('bảng xếp hạng đổi tiêu chí qua URL', async () => {
  const { router, user } = renderApp('/bang-xep-hang')
  await user.click(await screen.findByRole('link', { name: 'Điểm cao' }, slow))
  await expect.poll(() => router.state.location.search, slow).toBe('?theo=danh-gia')
  expect(await screen.findAllByText(/lượt chấm/, {}, slow)).not.toHaveLength(0)
  // Kỳ (tuần/tháng) chỉ có ở tiêu chí lượt đọc
  expect(screen.queryByRole('navigation', { name: 'Kỳ xếp hạng' })).toBeNull()
})

test('danh sách truyện full lọc được và giữ bộ lọc trên URL', async () => {
  const { router, user } = renderApp('/danh-sach/hoan-thanh')
  expect(await screen.findByRole('heading', { level: 1, name: 'Truyện full' }, slow))
  await user.click(await screen.findByRole('combobox', { name: 'Sắp xếp' }, slow))
  await user.click(await screen.findByRole('option', { name: 'Đọc nhiều' }, slow))
  await expect.poll(() => router.state.location.search, slow).toBe('?sap-xep=doc-nhieu')
})
