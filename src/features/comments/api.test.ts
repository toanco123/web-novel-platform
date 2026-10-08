import { AuthError } from '@/features/auth/api'
import { stories } from '@/mocks/stories'
import { publishStory, registerUser, signInAs, signOut } from '@/test/helpers'
import {
  addComment,
  deleteComment,
  editComment,
  getComments,
  getMyRating,
  getRatingSummary,
  getReplies,
  rateStory,
  reportComment,
  setCommentLike,
} from './api'

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

test('bình luận chương tách riêng với bình luận của truyện', async () => {
  signIn()
  const storyBefore = await getComments(story.slug)
  const chapterBefore = await getComments(story.slug, { chapter: 3 })
  await addComment(story.slug, 'Đoạn cuối chương 3 hay ghê', 3)

  const chapter = await getComments(story.slug, { chapter: 3 })
  expect(chapter.total).toBe(chapterBefore.total + 1)
  expect(chapter.items[0]).toMatchObject({
    content: 'Đoạn cuối chương 3 hay ghê',
    chapterNumber: 3,
  })
  expect((await getComments(story.slug)).total).toBe(storyBefore.total)
  expect((await getComments(story.slug, { chapter: 4 })).items).not.toContainEqual(
    expect.objectContaining({ content: 'Đoạn cuối chương 3 hay ghê' }),
  )
})

test('bình luận hiện tên mới nhất của người viết', async () => {
  signIn()
  await addComment(story.slug, 'Hóng chương mới')
  const { updateProfile } = await import('@/features/auth/api')
  await updateProfile({ displayName: 'Tên Mới', avatarUrl: null })
  expect((await getComments(story.slug)).items[0].user.displayName).toBe('Tên Mới')
})

test('chống spam: gửi lại y hệt bị chặn, quá 3 bình luận / phút bị chặn', async () => {
  signIn()
  await addComment(story.slug, 'Hay quá')
  await expect(addComment(story.slug, ' Hay quá ')).rejects.toMatchObject({
    code: 'rate_limited',
    message: 'Bạn vừa gửi bình luận này rồi.',
  })
  // Cùng nội dung nhưng ở chương khác thì vẫn gửi được
  await addComment(story.slug, 'Hay quá', 1)
  await addComment(story.slug, 'Chờ chương mới')
  await expect(addComment(story.slug, 'Bình luận thứ tư')).rejects.toMatchObject({
    code: 'rate_limited',
  })
})

test('trả lời nằm dưới bình luận gốc, không lẫn vào danh sách bình luận', async () => {
  signIn()
  const before = await getComments(story.slug)
  const root = await addComment(story.slug, 'Truyện này kết HE hay SE vậy?')
  expect(root).toMatchObject({ parentId: null, replyCount: 0 })
  const first = await addComment(story.slug, 'HE nha bạn', null, root.id)
  await addComment(story.slug, 'Cảm ơn bạn nhiều', null, root.id)
  expect(first).toMatchObject({ parentId: root.id, chapterNumber: null })

  const after = await getComments(story.slug)
  expect(after.total).toBe(before.total + 1)
  expect(after.items[0]).toMatchObject({ id: root.id, replyCount: 2 })
  // Trả lời: cũ nhất trước
  expect((await getReplies(root.id)).map((c) => c.content)).toEqual([
    'HE nha bạn',
    'Cảm ơn bạn nhiều',
  ])
})

test('trả lời được bình luận mẫu và bình luận chương', async () => {
  signIn()
  const seed = (await getComments(story.slug)).items[0]
  await addComment(story.slug, 'Mình cũng thấy vậy', null, seed.id)
  expect((await getComments(story.slug)).items[0]).toMatchObject({ id: seed.id, replyCount: 1 })

  const root = await addComment(story.slug, 'Đoạn cuối hay', 3)
  const reply = await addComment(story.slug, 'Chuẩn luôn', 3, root.id)
  expect(reply.chapterNumber).toBe(3)
  expect((await getComments(story.slug, { chapter: 3 })).items[0]).toMatchObject({
    id: root.id,
    replyCount: 1,
  })
})

test('không trả lời được vào một câu trả lời, bình luận đã xóa hay bình luận ở chỗ khác', async () => {
  signIn()
  const root = await addComment(story.slug, 'Bình luận gốc')
  const reply = await addComment(story.slug, 'Trả lời', null, root.id)
  await expect(addComment(story.slug, 'Lồng hai cấp', null, reply.id)).rejects.toBeInstanceOf(
    AuthError,
  )
  // Bình luận gốc của truyện không nhận trả lời gửi từ trang chương
  await expect(addComment(story.slug, 'Sai chỗ', 3, root.id)).rejects.toBeInstanceOf(AuthError)
  await expect(addComment(story.slug, 'Không có gốc', null, 'khong-co')).rejects.toMatchObject({
    message: 'Bình luận này đã bị xóa nên không trả lời được nữa.',
  })
})

test('xóa bình luận gốc thì xóa luôn các trả lời', async () => {
  signIn()
  const root = await addComment(story.slug, 'Bình luận gốc')
  const linh = await registerUser('Linh', 'linh@gmail.com')
  await addComment(story.slug, 'Trả lời của Linh', null, root.id)
  // Người khác không xóa được
  await deleteComment(root.id)
  expect((await getReplies(root.id)).map((c) => c.user.id)).toEqual([linh])

  signInAs('demo')
  await deleteComment(root.id)
  expect(await getReplies(root.id)).toEqual([])
  expect((await getComments(story.slug)).items.map((c) => c.id)).not.toContain(root.id)
})

test('báo cáo bình luận: cần đăng nhập, không báo bình luận của mình hay bình luận đã xóa', async () => {
  await expect(reportComment({ commentId: 'x', reason: 'spam', note: '' })).rejects.toMatchObject({
    code: 'unauthenticated',
  })

  signIn()
  const mine = await addComment(story.slug, 'Bình luận của demo')
  await expect(
    reportComment({ commentId: mine.id, reason: 'spam', note: '' }),
  ).rejects.toMatchObject({ message: 'Bạn không thể báo cáo bình luận của chính mình.' })

  const linh = await registerUser('Linh', 'linh@gmail.com')
  await expect(
    reportComment({ commentId: mine.id, reason: 'offensive', note: ' Lời lẽ khó nghe ' }),
  ).resolves.toBeUndefined()
  // Báo lại cùng bình luận thì không lỗi (cập nhật báo cáo đang mở)
  await reportComment({ commentId: mine.id, reason: 'spam', note: '' })

  signInAs('demo')
  await deleteComment(mine.id)
  signInAs(linh)
  await expect(
    reportComment({ commentId: mine.id, reason: 'spam', note: '' }),
  ).rejects.toMatchObject({ message: 'Bình luận này không còn nữa.' })
})

test('báo cáo bình luận: tối đa 10 / giờ mỗi người', async () => {
  const { saveUserComments } = await import('@/mocks/activity')
  saveUserComments(
    Array.from({ length: 11 }, (_, i) => ({
      id: `c${i}`,
      storySlug: story.slug,
      chapterNumber: null,
      user: { id: 'demo', displayName: 'Bạn đọc Demo', avatarUrl: null },
      content: `Bình luận ${i}`,
      createdAt: new Date().toISOString(),
      parentId: null,
      replyCount: 0,
      likeCount: 0,
      likedByMe: false,
      editedAt: null,
      isAuthor: false,
    })),
  )
  await registerUser('Linh', 'linh@gmail.com')
  for (let i = 0; i < 10; i++) await reportComment({ commentId: `c${i}`, reason: 'spam', note: '' })
  // Báo lại bình luận đã báo thì không tính thêm
  await reportComment({ commentId: 'c0', reason: 'other', note: 'Quảng cáo web khác' })
  await expect(reportComment({ commentId: 'c10', reason: 'spam', note: '' })).rejects.toMatchObject(
    { code: 'rate_limited' },
  )
})

// ── Thích, sắp xếp Nổi bật, sửa, chủ truyện xóa ─────────────────────────

test('thích và bỏ thích bình luận; bấm lặp lại không lỗi', async () => {
  signIn()
  const root = await addComment(story.slug, 'Bình luận của demo')
  await registerUser('Linh', 'linh@gmail.com')
  await setCommentLike(root.id, true)
  await setCommentLike(root.id, true)
  expect((await getComments(story.slug)).items[0]).toMatchObject({
    id: root.id,
    likeCount: 1,
    likedByMe: true,
  })
  await setCommentLike(root.id, false)
  await setCommentLike(root.id, false)
  expect((await getComments(story.slug)).items[0]).toMatchObject({ likeCount: 0, likedByMe: false })
})

test('thích trả lời; khách thấy số nhưng không thích được', async () => {
  signIn()
  const root = await addComment(story.slug, 'Gốc')
  const reply = await addComment(story.slug, 'Trả lời', null, root.id)
  await registerUser('Linh', 'linh@gmail.com')
  await setCommentLike(reply.id, true)
  expect((await getReplies(root.id))[0]).toMatchObject({ likeCount: 1, likedByMe: true })

  signOut()
  await expect(setCommentLike(reply.id, true)).rejects.toMatchObject({ code: 'unauthenticated' })
  expect((await getReplies(root.id))[0]).toMatchObject({ likeCount: 1, likedByMe: false })
})

test('không tự thích bình luận của mình, không thích bình luận đã xóa', async () => {
  signIn()
  const mine = await addComment(story.slug, 'Của demo')
  await expect(setCommentLike(mine.id, true)).rejects.toMatchObject({
    message: 'Bạn không thể tự thích bình luận của mình.',
  })
  await deleteComment(mine.id)
  await registerUser('Linh', 'linh@gmail.com')
  await expect(setCommentLike(mine.id, true)).rejects.toMatchObject({
    message: 'Bình luận này không còn nữa.',
  })
})

test('thích được bình luận mẫu (có sẵn lượt thích gốc)', async () => {
  signIn()
  const seed = (await getComments(story.slug)).items[0]
  await setCommentLike(seed.id, true)
  const after = (await getComments(story.slug)).items[0]
  expect(after).toMatchObject({ id: seed.id, likeCount: seed.likeCount + 1, likedByMe: true })
})

test('thích: tối đa 300 lượt mới / giờ mỗi người', async () => {
  const { saveCommentLikes } = await import('@/mocks/activity')
  signIn()
  const target = await addComment(story.slug, 'Bình luận để thích')
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const now = new Date().toISOString()
  saveCommentLikes(
    Array.from({ length: 300 }, (_, i) => ({ commentId: `x${i}`, userId: linh, createdAt: now })),
  )
  await expect(setCommentLike(target.id, true)).rejects.toMatchObject({ code: 'rate_limited' })
})

test('sắp xếp Nổi bật: nhiều lượt thích lên đầu, bằng nhau thì mới hơn trước', async () => {
  await registerUser('Tác Giả', 'tacgia@gmail.com')
  const mine = await publishStory('Truyện Của Tôi', 1)
  const a = await addComment(mine.slug, 'Bình luận A')
  const b = await addComment(mine.slug, 'Bình luận B')
  const c = await addComment(mine.slug, 'Bình luận C')
  await registerUser('Linh', 'linh@gmail.com')
  await setCommentLike(a.id, true)
  await setCommentLike(b.id, true)
  await registerUser('Hoa', 'hoa@gmail.com')
  await setCommentLike(a.id, true)

  const ids = async (sort?: 'top') =>
    (await getComments(mine.slug, { sort })).items.map((x) => x.id)
  expect(await ids('top')).toEqual([a.id, b.id, c.id])
  expect(await ids()).toEqual([c.id, b.id, a.id])
})

test('sửa bình luận: bỏ khoảng trắng, đặt editedAt; người khác không sửa được', async () => {
  signIn()
  const root = await addComment(story.slug, 'Bản đầu')
  expect(root.editedAt).toBeNull()
  const edited = await editComment(root.id, '  Bản đã sửa  ')
  expect(edited).toMatchObject({ id: root.id, content: 'Bản đã sửa' })
  expect(edited.editedAt).not.toBeNull()
  expect((await getComments(story.slug)).items[0]).toMatchObject({
    content: 'Bản đã sửa',
    editedAt: edited.editedAt,
  })

  await registerUser('Linh', 'linh@gmail.com')
  await expect(editComment(root.id, 'Linh sửa')).rejects.toMatchObject({
    message: 'Bình luận này không còn nữa.',
  })
  expect((await getComments(story.slug)).items[0].content).toBe('Bản đã sửa')
})

test('chủ truyện xóa được bình luận và trả lời của người khác; lượt thích mất theo', async () => {
  const { loadCommentLikes } = await import('@/mocks/activity')
  const owner = await registerUser('Tác Giả', 'tacgia@gmail.com')
  const mine = await publishStory('Truyện Của Tôi', 2)
  await registerUser('Linh', 'linh@gmail.com')
  const root = await addComment(mine.slug, 'Bình luận của Linh')
  const reply = await addComment(mine.slug, 'Linh tự trả lời', null, root.id)
  const other = await addComment(mine.slug, 'Bình luận chương', 1)
  await registerUser('Hoa', 'hoa@gmail.com')
  await setCommentLike(root.id, true)
  // Người lạ không xóa được
  await deleteComment(other.id)
  expect((await getComments(mine.slug, { chapter: 1 })).total).toBe(1)

  signInAs(owner)
  await deleteComment(other.id)
  expect((await getComments(mine.slug, { chapter: 1 })).total).toBe(0)
  await deleteComment(root.id)
  expect((await getComments(mine.slug)).total).toBe(0)
  expect(await getReplies(root.id)).toEqual([])
  expect(loadCommentLikes().filter((l) => [root.id, reply.id].includes(l.commentId))).toEqual([])
})

test('nhãn Tác giả: bình luận của chủ truyện, trừ truyện có bút danh', async () => {
  const { loadUserStories, saveUserStories } = await import('@/mocks/userContent')
  await registerUser('Tác Giả', 'tacgia@gmail.com')
  const mine = await publishStory('Truyện Của Tôi', 2)
  const own = await addComment(mine.slug, 'Cảm ơn mọi người đã đọc')
  await registerUser('Linh', 'linh@gmail.com')
  const reader = await addComment(mine.slug, 'Hóng chương mới', null, own.id)
  expect((await getComments(mine.slug)).items[0]).toMatchObject({ id: own.id, isAuthor: true })
  expect((await getReplies(own.id))[0]).toMatchObject({ id: reader.id, isAuthor: false })

  saveUserStories(
    loadUserStories().map((s) => (s.slug === mine.slug ? { ...s, authorName: 'Bút Danh' } : s)),
  )
  expect((await getComments(mine.slug)).items[0].isAuthor).toBe(false)
})
