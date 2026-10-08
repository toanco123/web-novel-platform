// Hẹn giờ đăng chương ở bản giả: đặt / đổi / hủy giờ hẹn, luật giờ hợp lệ, tới giờ thì chương tự ra
import { getChapterList } from '@/features/chapters/api'
import { getStory } from '@/features/stories/api'
import { publishStory, signInAs } from '@/test/helpers'
import * as studio from './api'

const HOUR = 3_600_000
const chapter = { title: 'Chương hẹn giờ', content: 'Nội dung chương. '.repeat(20) }
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString()

beforeEach(() => {
  localStorage.clear()
  // Chỉ giả Date: độ trễ của api giả vẫn chạy bằng setTimeout thật
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T03:00:00Z'))
  signInAs('demo')
})
afterEach(() => vi.useRealTimers())

/** Truyện công khai có chương 1 đã xuất bản, cộng các chương nháp `drafts` */
async function storyWithDrafts(drafts: number[]) {
  const story = await publishStory('Truyện Hẹn Giờ', 1)
  for (const number of drafts) await studio.saveChapter(story.id, { ...chapter, newNumber: number })
  return story
}

test('hẹn giờ, đổi giờ và hủy hẹn chương nháp; người đọc thấy chương sắp ra', async () => {
  const story = await storyWithDrafts([2])
  const at = inHours(5)
  expect(await studio.setChapterSchedule(story.id, 2, at)).toMatchObject({
    status: 'draft',
    scheduledAt: at,
  })
  expect((await getStory(story.slug))?.nextChapter).toEqual({ number: 2, at })

  const later = inHours(30)
  await studio.setChapterSchedule(story.id, 2, later)
  expect((await getStory(story.slug))?.nextChapter).toEqual({ number: 2, at: later })

  expect(await studio.setChapterSchedule(story.id, 2, null)).toMatchObject({ scheduledAt: null })
  expect((await getStory(story.slug))?.nextChapter).toBeNull()
})

test('giờ hẹn quá gần, quá xa, hoặc chương đã xuất bản thì báo invalid_schedule', async () => {
  const story = await storyWithDrafts([2])
  const invalid = { code: 'invalid_schedule' }
  await expect(
    studio.setChapterSchedule(story.id, 2, new Date(Date.now() + 30_000).toISOString()),
  ).rejects.toMatchObject(invalid)
  await expect(studio.setChapterSchedule(story.id, 2, inHours(24 * 366))).rejects.toMatchObject(
    invalid,
  )
  await expect(studio.setChapterSchedule(story.id, 1, inHours(5))).rejects.toMatchObject(invalid)
  expect((await studio.getMyChapter(story.id, 2))?.scheduledAt).toBeNull()
})

test('lưu nháp kèm giờ hẹn; xuất bản tay thì bỏ giờ hẹn', async () => {
  const story = await publishStory('Truyện Hẹn Giờ', 1)
  const saved = await studio.saveChapter(story.id, chapter, { scheduledAt: inHours(2) })
  expect(saved).toMatchObject({ number: 2, status: 'draft', scheduledAt: inHours(2) })

  const published = await studio.saveChapter(story.id, { ...chapter, number: 2 }, { publish: true })
  expect(published).toMatchObject({ status: 'published', scheduledAt: null })

  const third = await studio.saveChapter(story.id, chapter, { scheduledAt: inHours(2) })
  expect(await studio.setChapterStatus(story.id, third.number, 'published')).toMatchObject({
    scheduledAt: null,
  })
})

test('tới giờ hẹn thì chương tự xuất bản, chương mới nhất và chương sắp ra đổi theo', async () => {
  const story = await storyWithDrafts([2, 3])
  const first = inHours(1)
  const second = inHours(25)
  await studio.setChapterSchedule(story.id, 2, first)
  await studio.setChapterSchedule(story.id, 3, second)
  expect((await getChapterList(story.slug)).items.map((c) => c.number)).toEqual([1])

  vi.setSystemTime(Date.now() + 2 * HOUR)
  expect((await getChapterList(story.slug)).items.map((c) => c.number)).toEqual([1, 2])
  expect(await getStory(story.slug)).toMatchObject({
    latestChapter: { number: 2 },
    nextChapter: { number: 3, at: second },
  })
  expect(await studio.getMyChapter(story.id, 2)).toMatchObject({
    status: 'published',
    publishedAt: first,
    scheduledAt: null,
  })
})

test('xếp lịch nhiều chương một lần; một chương không hợp lệ thì không lưu gì', async () => {
  const story = await storyWithDrafts([2, 3])
  await expect(
    studio.scheduleChapters(story.id, [
      { number: 2, scheduledAt: inHours(1) },
      { number: 1, scheduledAt: inHours(2) },
    ]),
  ).rejects.toMatchObject({ code: 'invalid_schedule' })
  expect((await studio.getMyChapter(story.id, 2))?.scheduledAt).toBeNull()

  await studio.scheduleChapters(story.id, [
    { number: 2, scheduledAt: inHours(1) },
    { number: 3, scheduledAt: inHours(2) },
  ])
  const chapters = await studio.getMyChapters(story.id)
  expect(chapters.map((c) => c.scheduledAt)).toEqual([null, inHours(1), inHours(2)])
})
