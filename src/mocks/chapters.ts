import { pick, seededRandom } from '@/lib/seededRandom'
import type { ChapterSummary } from '@/types/chapter'
import type { Story } from '@/types/story'

const titles = [
  'Gặp lại',
  'Mưa đầu mùa',
  'Bức thư chưa gửi',
  'Tiệc rượu trong cung',
  'Người đứng dưới hiên',
  'Lời hứa năm ấy',
  'Đêm không ngủ',
  'Chén trà nguội',
  'Hiểu lầm',
  'Ánh đèn cuối phố',
  'Bí mật của thư phòng',
  'Cơn gió phương Bắc',
  'Trốn chạy',
  'Chiếc trâm ngọc',
  'Mở cửa',
  'Người thứ ba',
  'Tin đồn',
  'Cuộc gặp tình cờ',
  'Tuyết rơi',
  'Nửa đêm gõ cửa',
  'Trở về',
  'Tấm màn che',
  'Vết thương cũ',
  'Hôn ước',
  'Bữa sáng muộn',
  'Hồi ức',
  'Lựa chọn',
  'Kẻ giấu mặt',
  'Nắng sau mưa',
  'Hoa nở trái mùa',
]

const HOUR = 3600 * 1000
const cache = new Map<string, ChapterSummary[]>()

/** Danh sách chương giả, cố định theo slug; chương cuối trùng latestChapter của truyện */
export function mockChapters(story: Story): ChapterSummary[] {
  const cached = cache.get(story.slug)
  if (cached) return cached

  const rand = seededRandom(story.slug)
  const last = Date.parse(story.updatedAt)
  const count = story.chapterCount
  const chapters = Array.from({ length: count }, (_, i) => {
    const number = i + 1
    return {
      number,
      title:
        number === count && story.latestChapter ? story.latestChapter.title : pick(rand, titles),
      createdAt: new Date(last - (count - number) * 20 * HOUR).toISOString(),
    }
  })
  cache.set(story.slug, chapters)
  return chapters
}
