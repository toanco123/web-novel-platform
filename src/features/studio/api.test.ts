import { getLatestUpdated, getNewReleases, getStory } from '@/features/stories/api'
import { getChapterList } from '@/features/chapters/api'
import { addComment, getComments } from '@/features/comments/api'
import { reportChapter } from '@/features/feedback/api'
import { getGenres } from '@/features/genres/api'
import * as studio from './api'

beforeEach(() => localStorage.clear())
const signInAs = (id: string) => localStorage.setItem('mock-auth-session', JSON.stringify(id))

const input: studio.StoryInput = {
  title: 'Mùa Hạ Năm Ấy',
  description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
  genreSlugs: ['ngon-tinh', 'hien-dai'],
  status: 'ongoing',
  coverUrl: null,
}
const chapter = { title: 'Gặp lại', content: 'Nội dung chương. '.repeat(20) }

/** Người dùng thứ hai (đăng ký qua auth giả) */
async function secondUser() {
  const { signUp } = await import('@/features/auth/api')
  const { user } = await signUp({
    displayName: 'Linh',
    email: 'linh@gmail.com',
    password: 'matkhau123',
  })
  return user!.id
}

test('truyện mới là nháp, đường dẫn tự sinh và không trùng', async () => {
  signInAs('demo')
  const a = await studio.createStory(input)
  const b = await studio.createStory(input)
  expect(a).toMatchObject({ slug: 'mua-ha-nam-ay', visibility: 'draft', chapterCount: 0 })
  expect(b.slug).toBe('mua-ha-nam-ay-2')
  // Không trùng với truyện có sẵn
  const c = await studio.createStory({ ...input, title: 'Trường An Không Tuyết' })
  expect(c.slug).toBe('truong-an-khong-tuyet-2')
})

test('tạo truyện kèm chương 1: đăng ngay thì công khai, lưu nháp thì cả hai là nháp', async () => {
  signInAs('demo')
  const published = await studio.createStory(input, { chapter, publish: true })
  expect(published).toMatchObject({ visibility: 'published', chapterCount: 1, publishedCount: 1 })
  localStorage.removeItem('mock-auth-session')
  expect(await getStory(published.slug)).toMatchObject({ title: input.title, chapterCount: 1 })

  signInAs('demo')
  const draft = await studio.createStory(
    { ...input, title: 'Bản nháp' },
    { chapter, publish: false },
  )
  expect(draft).toMatchObject({ visibility: 'draft', chapterCount: 1, draftCount: 1 })
  expect(await studio.getMyChapters(draft.id)).toMatchObject([
    { number: 1, title: 'Gặp lại', status: 'draft' },
  ])
})

test('không xuất bản được truyện chưa có chương công khai', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter) // nháp
  await expect(studio.publishStory(story.id)).rejects.toMatchObject({
    code: 'no_published_chapters',
  })
})

test('nháp chỉ chủ truyện thấy; xuất bản rồi thì hiện công khai với đúng số chương', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter, { publish: true })
  await studio.saveChapter(story.id, { ...chapter, title: 'Nháp' }) // chương 2 nháp

  expect(await getStory(story.slug)).toMatchObject({ visibility: 'draft' }) // chủ truyện xem trước
  localStorage.removeItem('mock-auth-session')
  expect(await getStory(story.slug)).toBeNull() // người lạ không thấy

  signInAs('demo')
  await studio.publishStory(story.id)
  localStorage.removeItem('mock-auth-session')
  const pub = await getStory(story.slug)
  expect(pub).toMatchObject({
    chapterCount: 1,
    firstChapterNumber: 1,
    latestChapter: { number: 1, title: 'Gặp lại' },
    author: { name: 'Bạn đọc Demo' },
  })
  expect((await getLatestUpdated()).map((s) => s.slug)).toContain(story.slug)
  expect((await getNewReleases())[0].slug).toBe(story.slug)
  expect((await getChapterList(story.slug)).items.map((c) => c.number)).toEqual([1])
  expect((await getGenres()).find((g) => g.slug === 'hien-dai')?.storyCount).toBeGreaterThan(0)
})

test('không ẩn/xóa được chương công khai cuối cùng khi truyện đang công khai', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter, { publish: true })
  await studio.publishStory(story.id)
  await expect(studio.setChapterStatus(story.id, 1, 'draft')).rejects.toMatchObject({
    code: 'last_published_chapter',
  })
  await expect(studio.deleteChapter(story.id, 1)).rejects.toMatchObject({
    code: 'last_published_chapter',
  })
  await studio.unpublishStory(story.id)
  await studio.deleteChapter(story.id, 1)
  expect(await studio.getMyChapters(story.id)).toEqual([])
})

test('người khác không xem/sửa được truyện của mình', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await secondUser() // đăng ký xong là đăng nhập bằng tài khoản mới
  expect(await studio.getMyStory(story.id)).toBeNull()
  await expect(studio.updateStory(story.id, input)).rejects.toMatchObject({ code: 'not_found' })
  await expect(studio.deleteStory(story.id)).rejects.toMatchObject({ code: 'not_found' })
  expect(await studio.getMyStories()).toEqual([])
})

test('sửa chương giữ số chương; nhập nhiều chương đánh số tiếp nối', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter)
  await studio.saveChapter(story.id, { number: 1, title: 'Đổi tên', content: chapter.content })
  const added = await studio.importChapters(story.id, [chapter, chapter], true)
  expect(added.map((c) => [c.number, c.status])).toEqual([
    [2, 'published'],
    [3, 'published'],
  ])
  const all = await studio.getMyChapters(story.id)
  expect(all.map((c) => [c.number, c.title, c.status])).toEqual([
    [1, 'Đổi tên', 'draft'],
    [2, 'Gặp lại', 'published'],
    [3, 'Gặp lại', 'published'],
  ])
})

test('thống kê đếm lượt đọc của người khác, không tính lượt của tác giả', async () => {
  const { recordChapterView } = await import('@/features/chapters/api')
  const { followStory } = await import('@/features/library/api')
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter, { publish: true })
  await studio.saveChapter(story.id, { ...chapter, title: 'Hai' }, { publish: true })
  await studio.publishStory(story.id)
  await recordChapterView(story.slug, 1) // tác giả tự đọc: không tính

  const reader = await secondUser()
  signInAs(reader)
  await recordChapterView(story.slug, 1)
  await recordChapterView(story.slug, 2)
  await recordChapterView(story.slug, 2) // cùng lần tải trang: không tính lại
  await followStory(story.slug)

  signInAs('demo')
  const stats = await studio.getStoryStats(story.id)
  expect(stats).toMatchObject({ views: 2, viewsRecent: 2, followers: 1, comments: 0 })
  expect(stats.viewsByChapter.map((c) => c.views)).toEqual([1, 1])
  expect(stats.viewsByDay).toHaveLength(studio.STATS_DAYS)
  expect(stats.viewsByDay.at(-1)!.views).toBe(2)
  expect(await getStory(story.slug)).toMatchObject({ viewCount: 2 })
})

test('chọn số chương: bỏ trống chương 2 để viết chương 3, rồi viết bù', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter, { publish: true }) // chương 1
  await studio.saveChapter(story.id, { ...chapter, title: 'Ba', newNumber: 3 }, { publish: true })
  await studio.saveChapter(story.id, { ...chapter, title: 'Bốn' }) // mặc định: số tiếp theo
  await studio.saveChapter(story.id, { ...chapter, title: 'Hai', newNumber: 2 })

  expect((await studio.getMyChapters(story.id)).map((c) => `${c.number} ${c.title}`)).toEqual([
    '1 Gặp lại',
    '2 Hai',
    '3 Ba',
    '4 Bốn',
  ])
  await expect(studio.saveChapter(story.id, { ...chapter, newNumber: 3 })).rejects.toMatchObject({
    code: 'chapter_exists',
  })
})

test('chỉ đổi số được với chương chưa xuất bản lần nào', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter) // chương 1, nháp
  await studio.saveChapter(story.id, { ...chapter, number: 1, newNumber: 5 })
  expect((await studio.getMyChapters(story.id)).map((c) => c.number)).toEqual([5])

  // Đã xuất bản rồi chuyển về nháp vẫn giữ số (người đọc có thể đã lưu link, lịch sử đọc)
  await studio.setChapterStatus(story.id, 5, 'published')
  await studio.setChapterStatus(story.id, 5, 'draft')
  await expect(
    studio.saveChapter(story.id, { ...chapter, number: 5, newNumber: 6 }),
  ).rejects.toMatchObject({ code: 'chapter_number_locked' })
})

test('xóa chương thì xóa luôn bình luận và báo lỗi của chương, viết lại số đó không nhận nhầm', async () => {
  signInAs('demo')
  const story = await studio.createStory(input)
  await studio.saveChapter(story.id, chapter, { publish: true })
  await studio.saveChapter(story.id, chapter, { publish: true })
  await studio.publishStory(story.id)
  await addComment(story.slug, 'Chương 1 hay', 1)
  await addComment(story.slug, 'Chương 2 hay', 2)
  await reportChapter({ slug: story.slug, chapter: 2, reason: 'typo', note: 'Sai chính tả' })

  await studio.deleteChapter(story.id, 2)
  await studio.saveChapter(story.id, { ...chapter, newNumber: 2 }, { publish: true })

  expect((await getComments(story.slug, { chapter: 2 })).total).toBe(0)
  expect((await getComments(story.slug, { chapter: 1 })).total).toBe(1)
  expect(await studio.getStoryReports(story.id)).toEqual([])
})
