import { AuthError } from '@/features/auth/api'
import * as studio from '@/features/studio/api'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { reportChapter } from './api'

beforeEach(() => localStorage.clear())

test('báo lỗi cần đăng nhập', async () => {
  await expect(
    reportChapter({ slug: 'mong-hoa-luc', chapter: 1, reason: 'typo', note: '' }),
  ).rejects.toBeInstanceOf(AuthError)
})

test('tác giả thấy báo lỗi của truyện mình; báo trùng thì cập nhật, không nhân đôi', async () => {
  signInAs('demo')
  const story = await publishStory()

  const reader = await registerUser()
  signInAs(reader)
  await reportChapter({ slug: story.slug, chapter: 2, reason: 'typo', note: 'Sai chữ "gió"' })
  await reportChapter({ slug: story.slug, chapter: 2, reason: 'typo', note: 'Đoạn 3 sai chữ' })
  await reportChapter({ slug: story.slug, chapter: 1, reason: 'missing', note: '' })
  // Người khác không xem được báo lỗi của truyện không phải của mình
  await expect(studio.getStoryReports(story.id)).rejects.toMatchObject({ code: 'not_found' })

  signInAs('demo')
  const reports = await studio.getStoryReports(story.id)
  expect(reports).toHaveLength(2)
  expect(reports.find((r) => r.chapterNumber === 2)).toMatchObject({
    note: 'Đoạn 3 sai chữ',
    reporter: { displayName: 'Linh' },
    status: 'open',
  })
  expect((await studio.getMyStory(story.id))?.openReports).toBe(2)

  await studio.setReportStatus(story.id, reports[0].id, 'resolved')
  const after = await studio.getStoryReports(story.id)
  expect(after.at(-1)).toMatchObject({ id: reports[0].id, status: 'resolved' })
  expect((await studio.getMyStory(story.id))?.openReports).toBe(1)
})
