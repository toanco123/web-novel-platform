import { stories } from '@/mocks/stories'
import { publishStory, signInAs, signOut } from '@/test/helpers'
import { browseStories, getRanking, matchScore, searchStories } from './api'

beforeEach(() => localStorage.clear())

describe('tìm kiếm', () => {
  test('không phân biệt dấu, tên bắt đầu bằng từ khóa xếp trước', async () => {
    const result = await searchStories('truong an')
    expect(result.items[0].slug).toBe('truong-an-khong-tuyet')
    expect(result.total).toBeGreaterThan(0)
  })

  test('khớp theo tác giả và chấm điểm đúng thứ bậc', () => {
    const story = { title: 'Trường An Không Tuyết', author: { slug: 'x', name: 'Diệp Thanh Y' } }
    expect(matchScore(story, 'Trường An')).toBe(4)
    expect(matchScore(story, 'khong tuyet')).toBe(3)
    expect(matchScore(story, 'tuyet truong')).toBe(2)
    expect(matchScore(story, 'diep thanh')).toBe(1)
    expect(matchScore(story, 'kiem hiep')).toBe(0)
  })

  test('trả về thể loại có tên khớp; từ khóa trống thì không có kết quả', async () => {
    expect((await searchStories('co dai')).genres.map((g) => g.slug)).toEqual(['co-dai'])
    expect(await searchStories('   ')).toMatchObject({ total: 0, genres: [] })
  })

  test('tìm được truyện người dùng vừa xuất bản', async () => {
    signInAs('demo')
    await publishStory('Gió Mùa Đông Bắc')
    signOut()
    expect((await searchStories('gio mua')).items.map((s) => s.title)).toContain('Gió Mùa Đông Bắc')
  })
})

describe('danh sách có bộ lọc', () => {
  test('lọc trạng thái, thể loại, độ dài', async () => {
    const completed = await browseStories({ status: 'completed' })
    expect(completed.items.every((s) => s.status === 'completed')).toBe(true)
    expect(completed.total).toBe(stories.filter((s) => s.status === 'completed').length)

    const long = await browseStories({ genre: 'ngon-tinh', length: 'long' })
    expect(long.items.length).toBeGreaterThan(0)
    for (const s of long.items) {
      expect(s.chapterCount).toBeGreaterThan(200)
      expect(s.genres.map((g) => g.slug)).toContain('ngon-tinh')
    }
  })

  test('sắp xếp đọc nhiều và phân trang 24 truyện', async () => {
    const first = await browseStories({ sort: 'views' })
    const views = first.items.map((s) => s.viewCount)
    expect(views).toEqual([...views].sort((a, b) => b - a))
    expect(first.items.length).toBeLessThanOrEqual(24)
    expect(first.total).toBe(stories.length)
  })
})

describe('bảng xếp hạng', () => {
  test('lượt đọc tuần nhỏ hơn tháng, tháng nhỏ hơn tổng', async () => {
    const [week, month, all] = await Promise.all(
      (['week', 'month', 'all'] as const).map((period) => getRanking({ by: 'views', period })),
    )
    const of = (list: typeof week, slug: string) => list.find((r) => r.story.slug === slug)!.value
    const slug = 'truong-an-khong-tuyet'
    expect(of(week, slug)).toBeLessThan(of(month, slug))
    expect(of(month, slug)).toBeLessThan(of(all, slug))
    expect(week.map((r) => r.value)).toEqual([...week.map((r) => r.value)].sort((a, b) => b - a))
  })

  test('xếp theo điểm có tính số lượt chấm (truyện ít lượt không lên đầu)', async () => {
    const ranked = await getRanking({ by: 'rating' })
    expect(ranked[0].story.ratingCount).toBeGreaterThan(100)
    expect(ranked[0].value).toBe(ranked[0].story.ratingAvg)
  })
})
