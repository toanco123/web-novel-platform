// Tiện ích dùng chung cho test có dữ liệu giả (localStorage)
import { signUp } from '@/features/auth/api'
import * as studio from '@/features/studio/api'

export const signInAs = (id: string) =>
  localStorage.setItem('mock-auth-session', JSON.stringify(id))
export const signOut = () => localStorage.removeItem('mock-auth-session')

/** Tạo thêm một người dùng (đăng ký qua auth giả; sau đó phiên là của người này) */
export async function registerUser(name = 'Linh', email = 'linh@gmail.com') {
  const { user } = await signUp({ displayName: name, email, password: 'matkhau123' })
  return user!.id
}

/** Người dùng hiện tại đăng một truyện công khai có `chapters` chương đã xuất bản */
export async function publishStory(title = 'Mùa Hạ Năm Ấy', chapters = 2) {
  const story = await studio.createStory({
    title,
    description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
    genreSlugs: ['ngon-tinh', 'hien-dai'],
    status: 'ongoing',
    coverUrl: null,
  })
  for (let i = 1; i <= chapters; i++) {
    await studio.saveChapter(
      story.id,
      { title: `Chương thử ${i}`, content: 'Nội dung chương. '.repeat(20) },
      { publish: true },
    )
  }
  await studio.publishStory(story.id)
  return story
}
