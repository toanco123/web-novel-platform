import { screen, within } from '@testing-library/react'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
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

  // Xem dạng bảng của biểu đồ truyện theo thể loại
  const genreCard = screen.getByText('Truyện công khai theo thể loại').closest('.ant-card')!
  await user.click(within(genreCard as HTMLElement).getByText('Bảng'))
  expect(
    within(genreCard as HTMLElement).getByRole('columnheader', { name: 'Số truyện' }),
  ).toBeInTheDocument()

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

  // Mở khóa để Linh vào khu Sáng tác xem lý do
  const { setUserBanned } = await import('./api')
  await setUserBanned(linh, false)
  signInAs(linh)
  await router.navigate(`/studio/story/${story.id}`)
  expect(await screen.findByText(/Truyện đã bị ban quản trị gỡ/, {}, slow)).toBeInTheDocument()
  expect(screen.getByText(/Đạo văn/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xuất bản truyện' })).toBeDisabled()
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

  // Ô "Bình luận" ở Tổng quan dẫn sang trang kiểm duyệt
  await user.click(await screen.findByRole('link', { name: /2 bị báo cáo/ }, slow))
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
