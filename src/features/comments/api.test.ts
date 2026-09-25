import { AuthError } from '@/features/auth/api'
import { stories } from '@/mocks/stories'
import { addComment, getComments, getMyRating, getRatingSummary, rateStory } from './api'

const story = stories.find((s) => s.slug === 'mong-hoa-luc')!

beforeEach(() => localStorage.clear())
const signIn = () => localStorage.setItem('mock-auth-session', JSON.stringify('demo'))

test('chưa đăng nhập thì không bình luận hay chấm điểm được', async () => {
  await expect(addComment(story.slug, 'Hay')).rejects.toBeInstanceOf(AuthError)
  await expect(rateStory(story.slug, 5)).rejects.toBeInstanceOf(AuthError)
})

test('bình luận mới nằm đầu danh sách', async () => {
  signIn()
  const before = await getComments(story.slug)
  await addComment(story.slug, '  Chương này hay quá  ')
  const after = await getComments(story.slug)
  expect(after.total).toBe(before.total + 1)
  expect(after.items[0]).toMatchObject({ content: 'Chương này hay quá', user: { id: 'demo' } })
})

test('chấm điểm cập nhật điểm trung bình, chấm lại thì thay điểm cũ', async () => {
  signIn()
  const base = await getRatingSummary(story.slug)
  await rateStory(story.slug, 1)
  await rateStory(story.slug, 5)
  const after = await getRatingSummary(story.slug)
  expect(after.count).toBe(base.count + 1)
  expect(after.average).toBeCloseTo(
    (story.ratingAvg * story.ratingCount + 5) / (story.ratingCount + 1),
  )
  expect(await getMyRating(story.slug)).toBe(5)
})
