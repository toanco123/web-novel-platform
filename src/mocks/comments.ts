import { pick, seededRandom } from '@/lib/seededRandom'
import type { Comment } from '@/types/comment'
import type { Story } from '@/types/story'

const names = [
  'Mèo Lười',
  'Hạ Vy',
  'Tiểu Ngư',
  'Minh Anh',
  'Gió Heo May',
  'Bánh Bao Nhân Đậu',
  'Thu Trang',
  'Lãnh Nguyệt',
  'Cá Mặn',
  'Hoàng Yến',
]

const texts = [
  'Truyện hay quá, đọc một mạch tới 3 giờ sáng luôn 😭',
  'Nam chính lúc đầu hơi khó ưa nhưng càng về sau càng thương.',
  'Văn phong mượt, dịch cũng ổn. Mong tác giả ra chương đều.',
  'Chương mới nhất đọc mà tức giùm nữ chính, hóng chương sau.',
  'Ai biết truyện nào giống giống thế này giới thiệu mình với!',
  'Đoạn gặp lại dưới mưa đỉnh thật sự, đọc lại lần thứ ba rồi.',
  'Tuyến phụ cũng hay, mong có ngoại truyện cho cặp phụ.',
  'Hơi chậm ở khúc giữa nhưng qua được thì cuốn lắm.',
  'Cho mình hỏi truyện này HE hay SE vậy mọi người?',
  'Lâu lắm mới đọc được bộ cổ đại mà không bị ngấy.',
  'Tác giả viết cảnh nội tâm rất tinh tế, thích nhất điểm này.',
  'Đã thêm vào tủ, cuối tuần cày tiếp.',
]

const HOUR = 3600 * 1000

/** Bình luận mẫu cố định theo slug (3–18 bình luận mỗi truyện) */
export function seedComments(story: Story): Comment[] {
  const rand = seededRandom(`comments:${story.slug}`)
  const count = 3 + Math.floor(rand() * 16)
  let hoursAgo = 1 + rand() * 5
  return Array.from({ length: count }, (_, i) => {
    hoursAgo += rand() * 30
    const name = pick(rand, names)
    return {
      id: `seed-${story.slug}-${i}`,
      storySlug: story.slug,
      user: { id: `seed-user-${name}`, displayName: name, avatarUrl: null },
      content: pick(rand, texts),
      createdAt: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
    }
  })
}
