import { stories } from '@/mocks/stories'
import * as studio from '@/features/studio/api'
import { getChapter, getChapterList } from './api'

const story = stories.find((s) => s.slug === 'truong-an-khong-tuyet')! // 412 chương

test('trang 1 có 50 chương, bắt đầu từ chương 1', async () => {
  const page = await getChapterList(story.slug)
  expect(page).toMatchObject({ page: 1, pageCount: 9, total: 412 })
  expect(page.items).toHaveLength(50)
  expect(page.items[0].number).toBe(1)
})

test('trang cuối chỉ còn số chương dư và chương cuối trùng latestChapter', async () => {
  const page = await getChapterList(story.slug, { page: 9 })
  expect(page.items).toHaveLength(12)
  expect(page.items.at(-1)).toMatchObject({
    number: 412,
    title: story.latestChapter!.title,
  })
})

test('xếp mới nhất trước và kẹp số trang ngoài khoảng', async () => {
  const desc = await getChapterList(story.slug, { order: 'desc' })
  expect(desc.items[0].number).toBe(412)
  const tooFar = await getChapterList(story.slug, { page: 99 })
  expect(tooFar.page).toBe(9)
})

describe('getChapter', () => {
  beforeEach(() => localStorage.clear())

  test('truyện có sẵn: nội dung cố định, có chương trước/sau, ngoài khoảng thì null', async () => {
    const first = await getChapter(story.slug, 1)
    expect(first).toMatchObject({ number: 1, prev: null, next: { number: 2 } })
    expect(first!.story).toMatchObject({ slug: story.slug, chapterCount: 412 })
    expect(first!.content.split('\n\n').length).toBeGreaterThan(10)
    expect((await getChapter(story.slug, 1))!.content).toBe(first!.content)

    const last = await getChapter(story.slug, 412)
    expect(last).toMatchObject({ title: story.latestChapter!.title, next: null })
    expect(await getChapter(story.slug, 413)).toBeNull()
    expect(await getChapter('khong-co-truyen-nay', 1)).toBeNull()
  })

  test('truyện người dùng: bỏ qua chương nháp khi tìm chương trước/sau', async () => {
    localStorage.setItem('mock-auth-session', JSON.stringify('demo'))
    const mine = await studio.createStory({
      title: 'Mùa Hạ Năm Ấy',
      description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
      genreSlugs: ['ngon-tinh'],
      status: 'ongoing',
      coverUrl: null,
    })
    const content = (title: string) => `${title}. `.repeat(30).trim()
    await studio.saveChapter(mine.id, { title: 'Một', content: content('Một') }, { publish: true })
    await studio.saveChapter(mine.id, { title: 'Hai', content: content('Hai') }) // nháp
    await studio.saveChapter(mine.id, { title: 'Ba', content: content('Ba') }, { publish: true })
    await studio.publishStory(mine.id)
    localStorage.removeItem('mock-auth-session')

    expect(await getChapter(mine.slug, 1)).toMatchObject({
      content: content('Một'),
      prev: null,
      next: { number: 3, title: 'Ba' },
    })
    expect(await getChapter(mine.slug, 2)).toBeNull()
    expect(await getChapter(mine.slug, 3)).toMatchObject({
      prev: { number: 1 },
      next: null,
      story: { chapterCount: 2 },
    })
  })
})
