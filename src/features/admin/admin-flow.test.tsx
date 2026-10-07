import { cleanup, screen, within } from '@testing-library/react'
import { pendingStory, publishStory, registerUser, signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'

// G2 vẽ bằng canvas, jsdom không có: thay biểu đồ bằng thẻ rỗng
vi.mock('@ant-design/plots', () => {
  const Stub = () => <div data-testid="chart" />
  return { Column: Stub, Line: Stub, Bar: Stub }
})

const slow = { timeout: 4000 }
beforeEach(() => localStorage.clear())

test('khách vào /admin thì chuyển sang đăng nhập', async () => {
  const { router } = renderApp('/admin')
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe('/login?next=%2Fadmin')
})

test('người thường thấy trang không tồn tại, không có mục Quản trị trong menu', async () => {
  await registerUser()
  const { user } = renderApp('/admin')
  expect(await screen.findByText('Trang bạn tìm không tồn tại.', {}, slow)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'Về trang chủ' }))
  await user.click(await screen.findByRole('button', { name: /Tài khoản của Linh/ }, slow))
  expect(await screen.findByRole('menuitem', { name: 'Tủ truyện' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Quản trị' })).not.toBeInTheDocument()
})

test('quản trị viên xem tổng quan, người dùng và truyện của một tác giả', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  await publishStory('Mùa Hạ Năm Ấy', 2)
  signInAs('demo')
  const { router, user } = renderApp('/')

  // Menu tài khoản có lối vào trang quản trị
  await user.click(await screen.findByRole('button', { name: /Tài khoản của Bạn đọc Demo/ }, slow))
  await user.click(await screen.findByRole('menuitem', { name: 'Quản trị' }))
  expect(await screen.findByRole('heading', { name: 'Tổng quan' }, slow)).toBeInTheDocument()
  expect(await screen.findByText('Người dùng', { selector: '.ant-statistic-title' }, slow))
  expect(screen.getByText('+1 trong kỳ')).toBeInTheDocument()

  // Khối "Cần xử lý": chưa có việc tồn thì ghi "Ổn"
  const attention = screen.getByText('Cần xử lý', { selector: '.ant-card-head-title' })
  const panel = within(attention.closest('.ant-card') as HTMLElement)
  expect(panel.getAllByText('Ổn')).toHaveLength(4)
  expect(panel.getByText('Không có việc tồn')).toBeInTheDocument()

  // Ô chính: lượt đọc trong kỳ, so với kỳ trước
  const hero = screen.getByText('Lượt đọc trong kỳ', { selector: 'p' }).closest('.ant-card')!
  expect(hero).toHaveTextContent('chưa có số liệu so với 30 ngày trước')

  // Thể loại: đổi sang số truyện rồi xem dạng bảng
  const genreTitle = screen.getByText('Thể loại', { selector: '.ant-card-head-title' })
  const genreCard = within(genreTitle.closest('.ant-card') as HTMLElement)
  await user.click(genreCard.getByText('Số truyện'))
  await user.click(genreCard.getByText('Bảng'))
  expect(genreCard.getByRole('columnheader', { name: 'Số truyện' })).toBeInTheDocument()

  // Lịch đọc 12 tuần cũng có dạng bảng
  expect(screen.getByText('Lịch đọc · 12 tuần')).toBeInTheDocument()

  // Người dùng: tìm theo tên không dấu
  const nav = screen.getAllByRole('navigation', { name: 'Quản trị' })[0]
  await user.click(within(nav).getByRole('link', { name: 'Người dùng' }))
  expect(await screen.findByRole('heading', { name: 'Người dùng' }, slow)).toBeInTheDocument()
  expect(await screen.findByText('linh@gmail.com', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('demo@webtruyen.vn')).toBeInTheDocument()
  await user.type(screen.getByRole('searchbox', { name: 'Tìm người dùng' }), 'linh{Enter}')
  await expect.poll(() => router.state.location.search, slow).toBe('?q=linh')
  await expect.poll(() => screen.queryByText('demo@webtruyen.vn'), slow).toBeNull()

  // Bấm số truyện → danh sách truyện của Linh
  await user.click(screen.getByRole('link', { name: '1 truyện của Linh' }))
  await expect
    .poll(() => router.state.location.pathname + router.state.location.search, slow)
    .toBe(`/admin/stories?owner=${linh}`)
  expect(await screen.findByRole('link', { name: 'Mùa Hạ Năm Ấy' }, slow)).toBeInTheDocument()
  expect(await screen.findByText('Tác giả: Linh', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Công khai', { selector: '.ant-tag' })).toBeInTheDocument()
})

test('hộp thư và báo lỗi: đánh dấu đã xử lý thì rời khỏi danh sách đang mở', async () => {
  const { sendContactMessage, reportChapter } = await import('@/features/feedback/api')
  await sendContactMessage({
    name: 'Lan',
    email: 'lan@gmail.com',
    topic: 'copyright',
    message: 'Truyện này đăng lại khi chưa xin phép tác giả.',
  })
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  await reportChapter({ slug: story.slug, chapter: 1, reason: 'violation', note: 'Nội dung lạ' })
  signInAs('demo')
  const { user } = renderApp('/admin/inbox')

  expect(await screen.findByText('lan@gmail.com', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Bản quyền nội dung')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Đã xử lý' }))
  expect(await screen.findByText('Không còn tin nhắn nào cần xử lý', {}, slow)).toBeInTheDocument()

  const nav = screen.getAllByRole('navigation', { name: 'Quản trị' })[0]
  await user.click(within(nav).getByRole('link', { name: 'Báo lỗi' }))
  expect(await screen.findByText('Nội dung lạ', {}, slow)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Chương 1: Chương thử 1' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Đã sửa' }))
  expect(await screen.findByText('Không có báo lỗi nào đang mở', {}, slow)).toBeInTheDocument()
})

test('khóa người dùng và gỡ truyện trên giao diện; tác giả thấy lý do gỡ', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  signInAs('demo')
  const { router, user } = renderApp('/admin/users?q=linh')

  // Không có nút khóa cho chính mình; khóa Linh sau khi xác nhận
  expect(await screen.findByText('linh@gmail.com', {}, slow)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Khóa' }))
  const popconfirm = (await screen.findByText('Khóa Linh?', {}, slow)).closest('.ant-popover')!
  await user.click(within(popconfirm as HTMLElement).getByRole('button', { name: 'Khóa' }))
  expect(await screen.findByText('Đã khóa', { selector: '.ant-tag' }, slow)).toBeInTheDocument()

  await router.navigate(`/admin/stories?owner=${linh}`)
  await user.click(await screen.findByRole('button', { name: 'Gỡ' }, slow))
  const dialog = await screen.findByRole('dialog', {}, slow)
  const confirm = within(dialog).getByRole('button', { name: 'Gỡ truyện' })
  expect(confirm).toBeDisabled()
  await user.type(within(dialog).getByLabelText('Lý do gỡ'), 'Đạo văn')
  await user.click(confirm)
  expect(await screen.findByText('Bị gỡ', { selector: '.ant-tag' }, slow)).toBeInTheDocument()

  // Mở khóa để Linh vào khu Sáng tác xem lý do. Phiên đăng nhập nằm trong cache của app đang
  // chạy, nên vẽ lại app với phiên của Linh
  const { setUserBanned } = await import('./api')
  await setUserBanned(linh, false)
  signInAs(linh)
  cleanup()
  renderApp(`/studio/story/${story.id}`)
  expect(await screen.findByText(/Truyện đã bị ban quản trị gỡ/, {}, slow)).toBeInTheDocument()
  expect(screen.getByText(/Đạo văn/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gửi duyệt' })).toBeDisabled()
})

test('thể loại: sửa tên và gộp trên giao diện', async () => {
  const { createGenre } = await import('@/features/genres/api')
  await registerUser('Linh', 'linh@gmail.com')
  await createGenre({ name: 'Tình cảm' })
  await createGenre({ name: 'Lãng mạn' })
  signInAs('demo')
  const { user } = renderApp('/admin/genres')

  const row = (name: string) => screen.getByRole('link', { name }).closest('tr')!
  await screen.findByRole('link', { name: 'Tình cảm' }, slow)
  await user.click(within(row('Tình cảm')).getByRole('button', { name: 'Sửa' }))
  const edit = await screen.findByRole('dialog', { name: /Sửa thể loại/ }, slow)
  const name = within(edit).getByLabelText('Tên thể loại')
  await user.clear(name)
  await user.type(name, 'Tình cảm học đường')
  await user.click(within(edit).getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByRole('link', { name: 'Tình cảm học đường' }, slow)).toBeInTheDocument()
  expect(screen.getByText('tinh-cam-hoc-duong')).toBeInTheDocument()

  await user.click(within(row('Lãng mạn')).getByRole('button', { name: 'Gộp vào…' }))
  const mergeDialog = await screen.findByRole('dialog', { name: /Gộp "Lãng mạn"/ }, slow)
  await user.click(within(mergeDialog).getByRole('combobox'))
  await user.click(await screen.findByTitle('Tình cảm học đường', {}, slow))
  await user.click(within(mergeDialog).getByRole('button', { name: 'Gộp' }))
  await expect.poll(() => screen.queryByRole('link', { name: 'Lãng mạn' }), slow).toBeNull()
})

test('nhập truyện hàng loạt: chọn 2 file, áp thể loại cho tất cả, nhập và xuất bản', async () => {
  signInAs('demo')
  const { user } = renderApp('/admin/import')
  const body = (n: number) => `Nội dung chương ${n}. `.repeat(12)
  const file = (name: string) =>
    new File(
      [
        `Giới thiệu truyện ${name}, đủ dài để qua kiểm tra.\n\nChương 1: Mở đầu\n${body(1)}\n\nChương 2: Kết\n${body(2)}`,
      ],
      `${name}.txt`,
      { type: 'text/plain' },
    )

  const input = (await screen.findByText(/Kéo các file .txt/, {}, slow))
    .closest('.ant-upload')!
    .querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, [file('Chí Phèo'), file('Lão Hạc')])
  expect(await screen.findByText('Chí Phèo.txt', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Lão Hạc.txt')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nhập 2 truyện' })).toBeDisabled()
  expect(screen.getByText('Còn 2 truyện cần sửa trước khi nhập.')).toBeInTheDocument()

  await user.type(screen.getAllByLabelText('Tác giả gốc')[0], 'Nam Cao')
  await user.click(screen.getByRole('combobox', { name: 'Thể loại cho tất cả' }))
  await user.click(await screen.findByTitle('Hiện đại', {}, slow))
  await user.click(screen.getByRole('button', { name: 'Áp dụng' }))

  await user.click(screen.getByRole('button', { name: 'Nhập 2 truyện' }))
  expect(await screen.findByText('Đã nhập 2/2 truyện.', {}, { timeout: 8000 })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Xem trang truyện' })).toHaveLength(2)

  const { getStory } = await import('@/features/stories/api')
  expect(await getStory('lao-hac')).toMatchObject({
    author: { name: 'Nam Cao' },
    chapterCount: 2,
    description: 'Giới thiệu truyện Lão Hạc, đủ dài để qua kiểm tra.',
  })
}, 20_000)

test('trang chủ: chọn truyện nổi bật, đổi thứ tự, lưu thì trang chủ dùng danh sách đó', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  await publishStory('Mùa Hạ Năm Ấy', 1)
  await publishStory('Gió Qua Hiên Nhà', 1)
  signInAs('demo')
  const { user } = renderApp('/admin')

  const nav = (await screen.findAllByRole('navigation', { name: 'Quản trị' }, slow))[0]
  await user.click(within(nav).getByRole('link', { name: 'Trang chủ' }))
  const card = await screen.findByRole('region', { name: 'Banner nổi bật' }, slow)
  expect(await within(card).findByText(/Chưa chọn truyện nào/, {}, slow)).toBeInTheDocument()
  expect(within(card).getByRole('button', { name: 'Lưu' })).toBeDisabled()

  const add = within(card).getByRole('combobox', { name: 'Thêm truyện vào Banner nổi bật' })
  await user.type(add, 'mua ha')
  await user.click(await screen.findByTitle('Mùa Hạ Năm Ấy', {}, slow))
  await user.type(add, 'gio qua')
  await user.click(await screen.findByTitle('Gió Qua Hiên Nhà', {}, slow))
  const titles = () =>
    within(card)
      .getAllByRole('listitem')
      .map((li) => within(li).getByRole('link').textContent)
  expect(titles()).toEqual(['Mùa Hạ Năm Ấy', 'Gió Qua Hiên Nhà'])

  await user.click(within(card).getByRole('button', { name: 'Đưa "Gió Qua Hiên Nhà" lên' }))
  expect(titles()).toEqual(['Gió Qua Hiên Nhà', 'Mùa Hạ Năm Ấy'])
  await user.click(within(card).getByRole('button', { name: 'Lưu' }))
  expect(await screen.findByText('Đã lưu Banner nổi bật.', {}, slow)).toBeInTheDocument()

  const { getFeaturedStories } = await import('@/features/stories/api')
  expect((await getFeaturedStories()).map((s) => s.title)).toEqual([
    'Gió Qua Hiên Nhà',
    'Mùa Hạ Năm Ấy',
  ])

  // Bỏ một truyện rồi lưu lại
  await user.click(within(card).getByRole('button', { name: 'Bỏ "Mùa Hạ Năm Ấy"' }))
  // jsdom không chạy hết hiệu ứng nên icon "loading" của lần lưu trước còn trong tên nút
  await user.click(within(card).getByRole('button', { name: /Lưu$/ }))
  await expect
    .poll(async () => (await getFeaturedStories()).map((s) => s.title), slow)
    .toEqual(['Gió Qua Hiên Nhà'])
}, 20_000)

test('kiểm duyệt bình luận: xem báo cáo, bỏ qua, xóa bình luận vi phạm', async () => {
  const comments = await import('@/features/comments/api')
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  const spam = await comments.addComment(story.slug, 'Vào web abc chấm com đọc nhanh hơn')
  const spoiler = await comments.addComment(story.slug, 'Cuối truyện hai người cưới nhau', 1)
  await comments.addComment(story.slug, 'Truyện dễ thương ghê')
  await registerUser('Mai', 'mai@gmail.com')
  await comments.reportComment({ commentId: spam.id, reason: 'spam', note: 'Quảng cáo web khác' })
  await comments.reportComment({ commentId: spoiler.id, reason: 'spoiler', note: '' })
  signInAs('demo')
  const { router, user } = renderApp('/admin')

  // Khối "Cần xử lý" ở Tổng quan: 2 bình luận bị báo cáo, dẫn sang trang kiểm duyệt
  const reported = await screen.findByText(
    'Bình luận bị báo cáo',
    { selector: '.ant-statistic-title' },
    slow,
  )
  const item = within(reported.closest('li')!)
  expect(item.getByText('2')).toBeInTheDocument()
  expect(item.getByText('Cần xử lý')).toBeInTheDocument()
  await user.click(item.getByRole('link', { name: /Mở kiểm duyệt/ }))
  expect(await screen.findByRole('heading', { name: 'Bình luận' }, slow)).toBeInTheDocument()
  const row = (text: string) => screen.getByText(text).closest('tr')!
  await screen.findByText('Vào web abc chấm com đọc nhanh hơn', {}, slow)
  expect(screen.queryByText('Truyện dễ thương ghê')).not.toBeInTheDocument()
  const spamRow = within(row('Vào web abc chấm com đọc nhanh hơn'))
  expect(spamRow.getByText('Spam, quảng cáo')).toBeInTheDocument()
  expect(spamRow.getByText(/Quảng cáo web khác/)).toBeInTheDocument()
  expect(spamRow.getByText(/Mai/)).toBeInTheDocument()
  expect(spamRow.getByRole('link', { name: 'Mùa Hạ Năm Ấy' })).toHaveAttribute(
    'href',
    `/story/${story.slug}`,
  )
  expect(
    within(row('Cuối truyện hai người cưới nhau')).getByRole('link', { name: /Chương 1/ }),
  ).toHaveAttribute('href', `/story/${story.slug}/chapter-1`)

  // Bỏ qua: bình luận còn nguyên, chỉ rời danh sách bị báo cáo
  await user.click(
    within(row('Cuối truyện hai người cưới nhau')).getByRole('button', { name: 'Bỏ qua' }),
  )
  await expect.poll(() => screen.queryByText('Cuối truyện hai người cưới nhau'), slow).toBeNull()

  await user.click(spamRow.getByRole('button', { name: 'Xóa' }))
  const popconfirm = (await screen.findByText('Xóa bình luận này?', {}, slow)).closest(
    '.ant-popover',
  )!
  await user.click(within(popconfirm as HTMLElement).getByRole('button', { name: 'Xóa' }))
  expect(
    await screen.findByText('Không có bình luận nào đang bị báo cáo', {}, slow),
  ).toBeInTheDocument()

  // Xem tất cả: bình luận bị xóa không còn, bình luận được bỏ qua vẫn còn
  await user.click(screen.getByText('Tất cả'))
  await expect.poll(() => router.state.location.search, slow).toBe('?view=all')
  expect(await screen.findByText('Truyện dễ thương ghê', {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Cuối truyện hai người cưới nhau')).toBeInTheDocument()
  expect(screen.queryByText('Vào web abc chấm com đọc nhanh hơn')).not.toBeInTheDocument()
}, 20_000)

// ── Lọc, sắp xếp, phân trang của bảng ───────────────────────────────────

const location = (router: { state: { location: { pathname: string; search: string } } }) =>
  router.state.location.pathname + router.state.location.search
/** Ô đầu tiên của từng dòng dữ liệu trong bảng đang hiện */
const firstCells = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

test('bảng người dùng: bấm tiêu đề cột để sắp xếp, lọc theo vai trò, xóa bộ lọc', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  await publishStory('Mùa Hạ Năm Ấy', 1)
  await registerUser('Mai', 'mai@gmail.com')
  signInAs('demo')
  const { router, user } = renderApp('/admin/users')
  await screen.findByText('linh@gmail.com', {}, slow)
  // Mặc định: mới tham gia trước
  expect(firstCells()[0]).toContain('Mai')

  // Bấm tiêu đề cột: giảm dần → tăng dần → về mặc định
  const header = () => screen.getByRole('columnheader', { name: /Truyện/ })
  await user.click(header())
  await expect.poll(() => location(router), slow).toBe('/admin/users?sort=stories')
  await expect.poll(() => firstCells()[0], slow).toContain('Linh')
  expect(header()).toHaveAttribute('aria-sort', 'descending')
  await user.click(header())
  await expect.poll(() => location(router), slow).toBe('/admin/users?sort=stories&order=asc')
  await expect.poll(() => firstCells().at(-1), slow).toContain('Linh')
  await user.click(header())
  await expect.poll(() => location(router), slow).toBe('/admin/users')

  await user.click(screen.getByRole('combobox', { name: 'Vai trò' }))
  await user.click(await screen.findByTitle('Quản trị viên', {}, slow))
  await expect.poll(() => location(router), slow).toBe('/admin/users?role=admin')
  await expect.poll(() => screen.queryByText('linh@gmail.com'), slow).toBeNull()
  expect(screen.getByText('demo@webtruyen.vn')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await expect.poll(() => location(router), slow).toBe('/admin/users')
  expect(await screen.findByText('linh@gmail.com', {}, slow)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Xóa bộ lọc' })).not.toBeInTheDocument()
}, 20_000)

test('bảng truyện: đổi số dòng mỗi trang, lọc bị gỡ và tiến độ, URL cũ ?sort=views vẫn đúng', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 1)
  signInAs('demo')
  const { setStoryTakedown } = await import('./api')
  await setStoryTakedown(story.id, 'Đạo văn')
  const { router, user } = renderApp('/admin/stories?sort=views')

  await screen.findByRole('link', { name: 'Trường An Không Tuyết' }, slow)
  // Truyện mẫu nhiều lượt đọc nhất
  expect(firstCells()[0]).toBe('Trọng Sinh Chi Đích Nữ Phong Hoa')
  expect(screen.getByRole('columnheader', { name: /Lượt đọc/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  expect(screen.getByText(/^1–15 trong 15$/)).toBeInTheDocument()

  await user.click(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }))
  await user.click(await screen.findByTitle('10 / trang', {}, slow))
  await expect.poll(() => location(router), slow).toBe('/admin/stories?sort=views&size=10')
  await expect.poll(() => firstCells().length, slow).toBe(10)
  expect(screen.getByText(/^1–10 trong 15$/)).toBeInTheDocument()

  await user.click(screen.getByText('Bị gỡ'))
  await expect.poll(() => firstCells(), slow).toEqual(['Mùa Hạ Năm Ấy'])
  expect(router.state.location.search).toContain('visibility=takedown')

  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await user.click(screen.getByRole('combobox', { name: 'Tiến độ' }))
  await user.click(await screen.findByTitle('Hoàn thành', {}, slow))
  await expect.poll(() => router.state.location.search, slow).toContain('status=completed')
  await expect
    .poll(() => screen.queryByRole('link', { name: 'Trường An Không Tuyết' }), slow)
    .toBeNull()
  expect(linh).toBeTruthy()
}, 20_000)

test('hộp thư: lọc theo chủ đề, tìm, sắp theo lúc gửi', async () => {
  const { sendContactMessage } = await import('@/features/feedback/api')
  await sendContactMessage({
    name: 'Lan',
    email: 'lan@gmail.com',
    topic: 'copyright',
    message: 'Truyện này đăng lại khi chưa xin phép tác giả.',
  })
  await sendContactMessage({
    name: 'Hùng',
    email: 'hung@gmail.com',
    topic: 'bug',
    message: 'Trang đọc bị lỗi trên điện thoại.',
  })
  signInAs('demo')
  const { router, user } = renderApp('/admin/inbox')
  await screen.findByText('lan@gmail.com', {}, slow)
  expect(firstCells()[0]).toContain('Hùng')

  // Cột đang là thứ tự mặc định (giảm dần): bấm một lần thì thành tăng dần
  await user.click(screen.getByRole('columnheader', { name: /Gửi lúc/ }))
  await expect.poll(() => location(router), slow).toBe('/admin/inbox?sort=created&order=asc')
  await expect.poll(() => firstCells()[0], slow).toContain('Lan')

  await user.click(screen.getByRole('combobox', { name: 'Chủ đề' }))
  await user.click(await screen.findByTitle('Báo lỗi trang web', {}, slow))
  await expect.poll(() => firstCells().length, slow).toBe(1)
  expect(firstCells()[0]).toContain('Hùng')

  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await user.type(screen.getByRole('searchbox', { name: 'Tìm tin nhắn' }), 'xin phep{Enter}')
  await expect.poll(() => router.state.location.search, slow).toContain('q=xin+phep')
  await expect.poll(() => firstCells().length, slow).toBe(1)
  expect(firstCells()[0]).toContain('Lan')
}, 20_000)

test('báo lỗi và bình luận: lọc theo lý do, tìm; lọc trả lời', async () => {
  const { reportChapter } = await import('@/features/feedback/api')
  const comments = await import('@/features/comments/api')
  await registerUser('Linh', 'linh@gmail.com')
  const story = await publishStory('Mùa Hạ Năm Ấy', 2)
  const root = await comments.addComment(story.slug, 'Bình luận gốc của Linh')
  await comments.addComment(story.slug, 'Trả lời của Linh', null, root.id)
  await registerUser('Mai', 'mai@gmail.com')
  await reportChapter({
    slug: story.slug,
    chapter: 1,
    reason: 'typo',
    note: 'Sai chính tả dòng ba',
  })
  await reportChapter({ slug: story.slug, chapter: 2, reason: 'violation', note: 'Nội dung lạ' })
  signInAs('demo')
  const { router, user } = renderApp('/admin/reports')

  await screen.findByText('Nội dung lạ', {}, slow)
  await user.click(screen.getByRole('combobox', { name: 'Lý do' }))
  await user.click(await screen.findByTitle('Sai chính tả, lỗi đánh máy', {}, slow))
  await expect.poll(() => screen.queryByText('Nội dung lạ'), slow).toBeNull()
  expect(screen.getByText('Sai chính tả dòng ba')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
  await user.type(screen.getByRole('searchbox', { name: 'Tìm báo lỗi' }), 'noi dung{Enter}')
  await expect.poll(() => screen.queryByText('Sai chính tả dòng ba'), slow).toBeNull()
  expect(screen.getByText('Nội dung lạ')).toBeInTheDocument()

  await router.navigate('/admin/comments?view=all')
  await screen.findByText('Trả lời của Linh', {}, slow)
  await user.click(screen.getByRole('combobox', { name: 'Loại' }))
  await user.click(await screen.findByTitle('Bình luận gốc', {}, slow))
  await expect.poll(() => router.state.location.search, slow).toContain('kind=root')
  await expect.poll(() => screen.queryByText('Trả lời của Linh'), slow).toBeNull()
  expect(screen.getByText('Bình luận gốc của Linh')).toBeInTheDocument()
}, 20_000)

test('duyệt truyện: từ Tổng quan vào hàng chờ, duyệt một truyện, từ chối một truyện', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  await pendingStory('Mùa Hạ Năm Ấy')
  await pendingStory('Gió Qua Hiên Nhà')
  signInAs('demo')
  const { router, user } = renderApp('/admin')

  expect(
    await screen.findByText('Truyện chờ duyệt', { selector: '.ant-statistic-title' }, slow),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: /Mở hàng chờ/ }))
  expect(await screen.findByRole('heading', { name: 'Duyệt truyện' }, slow)).toBeInTheDocument()
  const row = (title: string) => screen.getByText(title, { selector: 'strong' }).closest('tr')!
  await screen.findByText('Mùa Hạ Năm Ấy', { selector: 'strong' }, slow)
  expect(within(row('Mùa Hạ Năm Ấy')).getByRole('link', { name: /Xem trước/ })).toHaveAttribute(
    'href',
    '/story/mua-ha-nam-ay',
  )

  // Duyệt
  await user.click(within(row('Mùa Hạ Năm Ấy')).getByRole('button', { name: 'Duyệt' }))
  const popconfirm = (await screen.findByText(/Duyệt "Mùa Hạ Năm Ấy"/, {}, slow)).closest(
    '.ant-popover',
  )!
  await user.click(within(popconfirm as HTMLElement).getByRole('button', { name: 'Duyệt' }))
  await expect
    .poll(() => screen.queryByText('Mùa Hạ Năm Ấy', { selector: 'strong' }), slow)
    .toBeNull()

  // Từ chối: bắt buộc lý do
  await user.click(within(row('Gió Qua Hiên Nhà')).getByRole('button', { name: 'Từ chối' }))
  const dialog = await screen.findByRole('dialog', {}, slow)
  const confirm = within(dialog).getByRole('button', { name: 'Từ chối' })
  expect(confirm).toBeDisabled()
  await user.type(within(dialog).getByLabelText('Lý do từ chối'), 'Bìa vi phạm')
  await user.click(confirm)
  await expect
    .poll(() => screen.queryByText('Gió Qua Hiên Nhà', { selector: 'strong' }), slow)
    .toBeNull()

  // Tab "Bị từ chối" có lý do; không có "Xem trước" (quản trị viên chỉ đọc được truyện chờ duyệt)
  await user.click(screen.getByText('Bị từ chối', { selector: '.ant-segmented-item-label' }))
  await expect.poll(() => router.state.location.search, slow).toBe('?status=rejected')
  await screen.findByText('Gió Qua Hiên Nhà', { selector: 'strong' }, slow)
  expect(within(row('Gió Qua Hiên Nhà')).getByText('Bìa vi phạm')).toBeInTheDocument()
  expect(
    within(row('Gió Qua Hiên Nhà')).queryByRole('link', { name: /Xem trước/ }),
  ).not.toBeInTheDocument()

  // Bảng Truyện: lọc theo trạng thái duyệt
  await router.navigate('/admin/stories?review=rejected')
  expect(await screen.findByText('Bị từ chối', { selector: '.ant-tag' }, slow)).toBeInTheDocument()
})

test('xem trước truyện chưa công khai: dải báo đúng người đang xem', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await pendingStory('Mùa Hạ Năm Ấy')
  renderApp(`/story/${story.slug}`)
  expect(
    await screen.findByText(/Truyện chưa công khai, chỉ bạn thấy trang này/, {}, slow),
  ).toBeInTheDocument()

  // Quản trị viên xem truyện chờ duyệt của người khác
  signInAs('demo')
  cleanup()
  renderApp(`/story/${story.slug}`)
  expect(
    await screen.findByText(/Truyện đang chờ duyệt, chỉ tác giả và ban quản trị/, {}, slow),
  ).toBeInTheDocument()
  expect(screen.queryByText(/chỉ bạn thấy/)).not.toBeInTheDocument()
})
