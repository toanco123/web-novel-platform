import { AuthError } from '@/features/auth/api'
import * as studio from '@/features/studio/api'
import { publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import type { ReadingProgress } from '@/types/library'
import {
  clearHistory,
  followStory,
  getLibrary,
  getLibraryUpdateCount,
  getReadingHistory,
  getStoryProgress,
  mergeHistory,
  removeFromHistory,
  saveReadingProgress,
  unfollowStory,
} from './api'

beforeEach(() => localStorage.clear())

const read = (slug: string, chapter: number, progress?: number) =>
  saveReadingProgress({ slug, chapter, chapterTitle: `Chương ${chapter}`, progress })

describe('lịch sử đọc', () => {
  test('mỗi truyện một dòng, đọc gần nhất lên đầu, cùng chương thì giữ vị trí cũ', async () => {
    signInAs('demo')
    await read('truong-an-khong-tuyet', 3, 0.5)
    await read('mong-hoa-luc', 1)
    await read('truong-an-khong-tuyet', 3) // mở lại cùng chương, không kèm vị trí

    const history = await getReadingHistory()
    expect(history.map((h) => h.story.slug)).toEqual(['truong-an-khong-tuyet', 'mong-hoa-luc'])
    expect(history[0].progress).toMatchObject({ chapter: 3, progress: 0.5 })

    await read('truong-an-khong-tuyet', 4) // sang chương khác thì vị trí về đầu
    expect(await getStoryProgress('truong-an-khong-tuyet')).toMatchObject({
      chapter: 4,
      progress: 0,
    })
  })

  test('khách cũng có lịch sử; đăng nhập thì được gộp vào tài khoản', async () => {
    await read('mong-hoa-luc', 7, 0.3)
    expect((await getReadingHistory()).map((h) => h.story.slug)).toEqual(['mong-hoa-luc'])

    signInAs('demo')
    expect(await getStoryProgress('mong-hoa-luc')).toMatchObject({ chapter: 7, progress: 0.3 })
    signOut()
    expect(await getReadingHistory()).toEqual([]) // lịch sử khách đã chuyển vào tài khoản
  })

  test('gộp lịch sử giữ lần đọc mới hơn của từng truyện', () => {
    const entry = (slug: string, chapter: number, readAt: string): ReadingProgress => ({
      slug,
      chapter,
      chapterTitle: '',
      progress: 0,
      readAt,
    })
    expect(
      mergeHistory(
        [entry('a', 1, '2026-09-01'), entry('b', 5, '2026-09-03')],
        [entry('a', 9, '2026-09-04'), entry('b', 2, '2026-09-02')],
      ).map((e) => [e.slug, e.chapter]),
    ).toEqual([
      ['a', 9],
      ['b', 5],
    ])
  })

  test('xóa một truyện hoặc toàn bộ lịch sử', async () => {
    signInAs('demo')
    await read('truong-an-khong-tuyet', 1)
    await read('mong-hoa-luc', 1)
    await removeFromHistory('mong-hoa-luc')
    expect((await getReadingHistory()).map((h) => h.story.slug)).toEqual(['truong-an-khong-tuyet'])
    await clearHistory()
    expect(await getReadingHistory()).toEqual([])
  })
})

describe('tủ truyện và chương mới', () => {
  test('cần đăng nhập', async () => {
    await expect(getLibrary()).rejects.toBeInstanceOf(AuthError)
    await expect(followStory('mong-hoa-luc')).rejects.toBeInstanceOf(AuthError)
  })

  test('tác giả ra chương mới thì người theo dõi thấy số chương mới; đọc tới thì hết', async () => {
    const reader = await registerUser()
    signInAs('demo')
    const story = await publishStory('Mùa Hạ Năm Ấy', 2)

    signInAs(reader)
    await followStory(story.slug)
    expect(await getLibraryUpdateCount()).toBe(0)

    signInAs('demo')
    await studio.saveChapter(
      story.id,
      { title: 'Chương mới', content: 'Nội dung. '.repeat(20) },
      { publish: true },
    )
    await studio.saveChapter(story.id, { title: 'Còn nháp', content: 'Nháp. '.repeat(20) })

    signInAs(reader)
    const [item] = await getLibrary()
    expect(item).toMatchObject({ newChapters: 1, progress: null })
    expect(await getLibraryUpdateCount()).toBe(1)

    await read(story.slug, 3)
    expect((await getLibrary())[0]).toMatchObject({
      newChapters: 0,
      progress: { chapter: 3 },
    })
  })

  test('truyện có chương mới xếp trước; bỏ theo dõi thì biến mất', async () => {
    signInAs('demo')
    await followStory('mong-hoa-luc')
    await followStory('truong-an-khong-tuyet')
    expect((await getLibrary()).map((i) => i.story.slug)).toContain('mong-hoa-luc')
    await unfollowStory('mong-hoa-luc')
    expect((await getLibrary()).map((i) => i.story.slug)).toEqual(['truong-an-khong-tuyet'])
  })

  test('dữ liệu theo dõi kiểu cũ (chỉ có slug) vẫn đọc được, không báo chương mới ảo', async () => {
    localStorage.setItem('mock-library', JSON.stringify({ demo: ['truong-an-khong-tuyet'] }))
    signInAs('demo')
    expect(await getLibrary()).toMatchObject([
      { story: { slug: 'truong-an-khong-tuyet' }, newChapters: 0 },
    ])
  })
})
