// Tiện ích dùng chung cho test có dữ liệu giả (localStorage)
import type { UserEvent } from '@testing-library/user-event'
import { reviewStory } from '@/features/admin/api'
import { getSession, signUp } from '@/features/auth/api'
import * as studio from '@/features/studio/api'

export const signInAs = (id: string) =>
  localStorage.setItem('mock-auth-session', JSON.stringify(id))
export const signOut = () => localStorage.removeItem('mock-auth-session')

/** Tạo thêm một người dùng (đăng ký qua auth giả; sau đó phiên là của người này) */
export async function registerUser(name = 'Linh', email = 'linh@gmail.com') {
  const { user } = await signUp({ displayName: name, email, password: 'matkhau123' })
  return user!.id
}

const storyInput = (title: string) => ({
  title,
  description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
  genreSlugs: ['ngon-tinh', 'hien-dai'],
  status: 'ongoing' as const,
  coverUrl: null,
})

/** Người dùng hiện tại tạo truyện (nháp) có `chapters` chương đã xuất bản */
export async function draftStory(title = 'Mùa Hạ Năm Ấy', chapters = 2) {
  const story = await studio.createStory(storyInput(title))
  for (let i = 1; i <= chapters; i++) {
    await studio.saveChapter(
      story.id,
      { title: `Chương thử ${i}`, content: 'Nội dung chương. '.repeat(20) },
      { publish: true },
    )
  }
  return story
}

/** Như draftStory rồi gửi duyệt: truyện nằm trong hàng chờ của quản trị viên */
export async function pendingStory(title = 'Mùa Hạ Năm Ấy', chapters = 1) {
  const story = await draftStory(title, chapters)
  await studio.submitStoryForReview(story.id)
  return story
}

/** Quản trị viên (tài khoản demo) duyệt truyện, xong trả lại phiên đang dùng */
export async function approveAsAdmin(storyId: string) {
  const session = localStorage.getItem('mock-auth-session')
  signInAs('demo')
  try {
    await reviewStory({ storyId, approve: true })
  } finally {
    if (session) localStorage.setItem('mock-auth-session', session)
    else signOut()
  }
}

/**
 * Người dùng hiện tại đăng một truyện công khai có `chapters` chương đã xuất bản. Tác giả thường thì
 * gửi duyệt rồi quản trị viên duyệt luôn.
 */
export async function publishStory(title = 'Mùa Hạ Năm Ấy', chapters = 2) {
  const story = await draftStory(title, chapters)
  if ((await getSession())?.isAdmin) await studio.publishStory(story.id)
  else {
    await studio.submitStoryForReview(story.id)
    await approveAsAdmin(story.id)
  }
  return story
}

/**
 * Viết vào trình soạn chương (Tiptap). jsdom không mô phỏng được việc gõ từng phím vào vùng
 * contenteditable của ProseMirror (mất ký tự), nên đưa con trỏ vào ô rồi dán cả đoạn văn.
 */
export async function writeInEditor(user: UserEvent, editor: HTMLElement, text: string) {
  await user.click(editor)
  await user.paste(text)
}
