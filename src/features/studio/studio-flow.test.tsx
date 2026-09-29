import { screen, waitFor, within } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'
import { writeInEditor } from '@/test/helpers'

const slow = { timeout: 4000 }
beforeEach(() => localStorage.clear())
const signIn = () => localStorage.setItem('mock-auth-session', JSON.stringify('demo'))
const content = 'Mùa hạ năm ấy, lớp mười một chuyển chỗ ngồi. '.repeat(5)

test('chưa đăng nhập vào khu Sáng tác thì chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/studio/new-story')
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/login?next=%2Fstudio%2Fnew-story')
})

test('đăng truyện → viết chương → xuất bản → truyện hiện công khai', async () => {
  signIn()
  const { router, user } = renderApp('/studio/new-story')

  // Form truyện: báo lỗi khi thiếu, rồi điền đủ
  await user.click(await screen.findByRole('button', { name: 'Lưu nháp' }, slow))
  expect(await screen.findByText('Chọn ít nhất 1 thể loại')).toBeInTheDocument()

  await user.type(screen.getByLabelText('Tên truyện'), 'Mùa Hạ Năm Ấy')
  await user.type(
    screen.getByLabelText('Giới thiệu'),
    'Một câu chuyện tình học trò nhẹ nhàng giữa hai người bạn cùng bàn.',
  )
  // Tạo thể loại mới ngay trong ô chọn
  const genres = screen.getByRole('combobox', { name: 'Thể loại (1–5)' })
  await user.type(genres, 'Thanh xuân')
  await user.click(await screen.findByRole('option', { name: 'Tạo thể loại “Thanh xuân”' }))
  expect(
    await screen.findByRole('button', { name: 'Bỏ thể loại Thanh xuân' }, slow),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

  // Trang quản lý: chưa xuất bản được vì chưa có chương
  expect(await screen.findByRole('heading', { level: 1, name: 'Mùa Hạ Năm Ấy' }, slow))
  expect(screen.getByRole('button', { name: 'Xuất bản truyện' })).toBeDisabled()

  await user.click(screen.getByRole('link', { name: 'Viết chương mới' }))
  await user.type(
    await screen.findByLabelText('Tiêu đề chương (không bắt buộc)', {}, slow),
    'Gặp lại',
  )
  await writeInEditor(user, screen.getByLabelText('Nội dung'), content)
  await user.click(screen.getByRole('button', { name: 'Xuất bản chương' }))

  const publish = await screen.findByRole('button', { name: 'Xuất bản truyện' }, slow)
  await waitFor(() => expect(publish).toBeEnabled(), slow)
  await user.click(publish)
  expect(await screen.findByText(/Truyện đã công khai/, {}, slow)).toBeInTheDocument()

  // Người đọc thấy truyện ở trang chủ và trang chi tiết
  localStorage.removeItem('mock-auth-session')
  await router.navigate('/')
  const latest = await screen.findByRole('heading', { name: 'Mới cập nhật' }, slow)
  const section = latest.closest('section')!
  expect(
    await within(section).findByRole('link', { name: 'Mùa Hạ Năm Ấy' }, slow),
  ).toBeInTheDocument()
  expect(within(section).getByRole('link', { name: 'Chương 1: Gặp lại' })).toBeInTheDocument()
})

test('tạo truyện kèm chương đầu tiên (chọn số chương) rồi bấm Đăng truyện thì công khai ngay', async () => {
  signIn()
  const { router, user } = renderApp('/studio/new-story?genre=ngon-tinh')
  await user.type(await screen.findByLabelText('Tên truyện', {}, slow), 'Gió Mùa Thu')
  await user.type(
    screen.getByLabelText('Giới thiệu'),
    'Một câu chuyện tình học trò nhẹ nhàng giữa hai người bạn cùng bàn.',
  )

  // Chưa viết chương thì chưa đăng được
  await user.click(screen.getByRole('button', { name: 'Đăng truyện' }))
  expect(await screen.findByText(/Viết nội dung chương để đăng truyện/)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/studio/new-story')

  // Truyện đăng tiếp từ nơi khác: bắt đầu từ chương 50
  const number = screen.getByLabelText('Số chương')
  expect(number).toHaveValue(1)
  await user.clear(number)
  await user.type(number, '50')
  await user.type(screen.getByLabelText('Tiêu đề chương'), 'Gặp lại')
  await writeInEditor(user, screen.getByLabelText('Nội dung chương'), content)
  await user.click(screen.getByRole('button', { name: 'Đăng truyện' }))

  // Sang trang quản lý: truyện đã công khai, có chương 50
  expect(await screen.findByRole('heading', { level: 1, name: 'Gió Mùa Thu' }, slow))
  expect(screen.getByRole('button', { name: 'Ẩn truyện' })).toBeInTheDocument()
  const list = await screen.findByRole('list', { name: 'Danh sách chương' }, slow)
  expect(within(list).getByText('Gặp lại')).toBeInTheDocument()
  expect(within(list).getByRole('link', { name: 'Sửa chương 50' })).toBeInTheDocument()

  // Người đọc thấy truyện ở trang chủ
  localStorage.removeItem('mock-auth-session')
  await router.navigate('/')
  const latest = await screen.findByRole('heading', { name: 'Mới cập nhật' }, slow)
  expect(
    await within(latest.closest('section')!).findByRole('link', { name: 'Gió Mùa Thu' }, slow),
  ).toBeInTheDocument()
})

test('rời trình soạn chương khi chưa lưu thì hỏi lại', async () => {
  signIn()
  const { createStory } = await import('./api')
  const story = await createStory({
    title: 'Truyện thử',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  const { router, user } = renderApp(`/studio/story/${story.id}/new-chapter`)
  await writeInEditor(user, await screen.findByLabelText('Nội dung', {}, slow), 'Đang viết dở…')
  await user.click(screen.getByRole('link', { name: 'Hủy' }))

  const dialog = await screen.findByRole('dialog', {}, slow)
  expect(within(dialog).getByText('Rời trang khi chưa lưu?')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Ở lại viết tiếp' }))
  expect(router.state.location.pathname).toMatch(/new-chapter$/)

  await user.click(screen.getByRole('link', { name: 'Hủy' }))
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rời trang' }),
  )
  await expect.poll(() => router.state.location.pathname, slow).toBe(`/studio/story/${story.id}`)
})

test('nhập file .txt: xem trước rồi thêm chương', async () => {
  signIn()
  const { createStory } = await import('./api')
  const story = await createStory({
    title: 'Truyện nhập file',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  const { user } = renderApp(`/studio/story/${story.id}/import`)
  const file = new File([`Chương 1: Một\n${content}\nChương 2: Hai\n${content}`], 'truyen.txt', {
    type: 'text/plain',
  })
  await user.upload(await screen.findByLabelText(/chọn file \.txt/, {}, slow), file)
  expect(await screen.findByRole('heading', { name: /Xem trước: 2 chương/ }, slow))

  await user.click(screen.getByRole('button', { name: 'Thêm 2 chương' }))
  const list = await screen.findByRole('list', { name: 'Danh sách chương' }, slow)
  expect(within(list).getByText('Một')).toBeInTheDocument()
  expect(within(list).getByText('Hai')).toBeInTheDocument()
})

test('xóa truyện phải gõ đúng tên', async () => {
  signIn()
  const { createStory } = await import('./api')
  const story = await createStory({
    title: 'Truyện sẽ xóa',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  const { router, user } = renderApp(`/studio/story/${story.id}`)
  await user.click(await screen.findByRole('button', { name: 'Xóa truyện' }, slow))
  const dialog = await screen.findByRole('dialog')
  const confirm = within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' })
  expect(confirm).toBeDisabled()
  await user.type(within(dialog).getByLabelText(/để xác nhận/), 'Truyện sẽ xóa')
  await user.click(confirm)
  await expect.poll(() => router.state.location.pathname, slow).toBe('/studio')
  expect(await screen.findByText('Bạn chưa đăng truyện nào', {}, slow)).toBeInTheDocument()
})

test('trang thể loại có sẵn: nút đăng truyện mở form với thể loại được chọn sẵn', async () => {
  signIn()
  const { router, user } = renderApp('/genres/ngon-tinh')
  await user.click(await screen.findByRole('link', { name: 'Đăng truyện Ngôn tình' }, slow))
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/studio/new-story?genre=ngon-tinh')
  expect(
    await screen.findByRole('button', { name: 'Bỏ thể loại Ngôn tình' }, slow),
  ).toBeInTheDocument()
})

test('?the-loai không có thật thì bỏ qua, form để trống thể loại', async () => {
  signIn()
  renderApp('/studio/new-story?genre=khong-co-that')
  expect(await screen.findByLabelText('Tên truyện', {}, slow)).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Thể loại đã chọn' })).not.toBeInTheDocument()
})

test('danh sách Sáng tác: menu ⋯ mở tab sửa thông tin và xóa truyện', async () => {
  signIn()
  const { createStory } = await import('./api')
  const story = await createStory({
    title: 'Truyện trong menu',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  const menu = { name: 'Thao tác cho truyện Truyện trong menu' }
  const { router, user } = renderApp('/studio')

  await user.click(await screen.findByRole('button', menu, slow))
  await user.click(await screen.findByRole('menuitem', { name: 'Sửa thông tin' }))
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe(`/studio/story/${story.id}?tab=info`)
  expect(
    await screen.findByRole('tab', { name: 'Thông tin truyện', selected: true }, slow),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Tên truyện')).toHaveValue('Truyện trong menu')

  // Xóa ngay từ danh sách: vẫn ở trang Sáng tác, báo đã xóa
  await router.navigate('/studio')
  await user.click(await screen.findByRole('button', menu, slow))
  await user.click(await screen.findByRole('menuitem', { name: 'Xóa truyện' }))
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText(/để xác nhận/), 'Truyện trong menu')
  await user.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))
  expect(await screen.findByText('Bạn chưa đăng truyện nào', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Đã xóa truyện “Truyện trong menu”.')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/studio')
})

test('chọn số chương: bỏ trống chương 2 để viết chương 3, rồi viết bù từ dòng "chưa viết"', async () => {
  signIn()
  const { createStory, saveChapter } = await import('./api')
  const story = await createStory({
    title: 'Truyện nhảy chương',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  await saveChapter(story.id, { title: 'Một', content }, { publish: true })
  const { router, user } = renderApp(`/studio/story/${story.id}/new-chapter`)

  const number = await screen.findByLabelText('Số chương', {}, slow)
  expect(number).toHaveValue(2)
  // Trùng số chương đã có thì báo ngay
  await user.clear(number)
  await user.type(number, '1')
  await user.tab()
  expect(await screen.findByText('Chương 1 đã có, chọn số khác')).toBeInTheDocument()

  await user.clear(number)
  await user.type(number, '3')
  expect(await screen.findByText(/Chương 2 chưa xuất bản/)).toBeInTheDocument()
  await writeInEditor(user, screen.getByLabelText('Nội dung'), content)
  await user.click(screen.getByRole('button', { name: 'Xuất bản chương' }))

  // Trang quản lý: chương 2 hiện là chỗ trống, bấm để viết bù
  const list = await screen.findByRole('list', { name: 'Danh sách chương' }, slow)
  await user.click(await within(list).findByRole('link', { name: 'Viết chương 2' }, slow))
  await expect.poll(() => router.state.location.search, slow).toBe('?number=2')
  expect(await screen.findByLabelText('Số chương', {}, slow)).toHaveValue(2)
})

test('đổi số chương nháp rồi lưu thì quay về trang quản lý với số mới', async () => {
  signIn()
  const { createStory, saveChapter } = await import('./api')
  const story = await createStory({
    title: 'Truyện đổi số',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  await saveChapter(story.id, { title: 'Nháp', content }) // chương 1, nháp
  const { router, user } = renderApp(`/studio/story/${story.id}/chapter/1`)

  const number = await screen.findByLabelText('Số chương', {}, slow)
  await user.clear(number)
  await user.type(number, '4')
  // Lưu xong, chương theo số cũ không còn: không được thoáng hiện trang "không tìm thấy"
  let notFoundShown = false
  const observer = new MutationObserver(() => {
    notFoundShown ||= !!document.body.textContent?.includes('Không tìm thấy chương này')
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

  await expect.poll(() => router.state.location.pathname, slow).toBe(`/studio/story/${story.id}`)
  const list = await screen.findByRole('list', { name: 'Danh sách chương' }, slow)
  observer.disconnect()
  expect(notFoundShown).toBe(false)
  expect(within(list).getByText('Chưa viết 3 chương')).toBeInTheDocument()
  expect(within(list).getByRole('link', { name: 'Sửa chương 4' })).toBeInTheDocument()
})

test('bút danh: đặt trong tab thông tin thì trang truyện hiện bút danh thay tên tài khoản', async () => {
  signIn()
  const { publishStory } = await import('@/test/helpers')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const { router, user } = renderApp(`/studio/story/${story.id}?tab=info`)

  const pen = await screen.findByLabelText('Tác giả / bút danh (không bắt buộc)', {}, slow)
  expect(pen).toHaveValue('')
  await user.type(pen, 'Hạ Vy')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('Đã lưu thay đổi.', {}, slow)).toBeInTheDocument()

  await router.navigate(`/story/${story.slug}`)
  // Trang Sáng tác cũng có tiêu đề truyện: chờ link tác giả của trang truyện
  expect(await screen.findByRole('link', { name: 'Hạ Vy' }, slow)).toBeInTheDocument()
  expect(screen.queryByText('Bạn đọc Demo')).not.toBeInTheDocument()
})

test('chương có định dạng: soạn chữ đậm → xuất bản → trang đọc hiện đúng định dạng', async () => {
  signIn()
  const { createStory, saveChapter } = await import('./api')
  const story = await createStory({
    title: 'Truyện định dạng',
    description: 'Mô tả đủ dài cho truyện thử nghiệm trong test.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
  })
  // Chương cũ kiểu văn bản thuần vẫn đọc như trước
  await saveChapter(
    story.id,
    { title: 'Một', content: `${content}\n\n${content}` },
    { publish: true },
  )
  const { router, user } = renderApp(`/studio/story/${story.id}/new-chapter`)

  await writeInEditor(user, await screen.findByLabelText('Nội dung', {}, slow), content)
  await user.click(screen.getByRole('button', { name: 'Chọn tất cả' }))
  await user.click(screen.getByRole('button', { name: 'Đậm' }))
  await user.click(screen.getByRole('button', { name: 'Xuất bản chương' }))
  await expect.poll(() => router.state.location.pathname, slow).toBe(`/studio/story/${story.id}`)

  await router.navigate(`/story/${story.slug}/chapter-2`)
  const article = await screen.findByRole('article', {}, slow)
  const paragraph = article.querySelector('[data-paragraph="0"]')!
  expect(paragraph.querySelector('strong')).toHaveTextContent(content.trim())

  await router.navigate(`/story/${story.slug}/chapter-1`)
  await expect
    .poll(() => document.querySelectorAll('[data-chapter="1"] [data-paragraph]').length, slow)
    .toBe(2)
  expect(document.querySelector('[data-chapter="1"] strong')).toBeNull()
})
