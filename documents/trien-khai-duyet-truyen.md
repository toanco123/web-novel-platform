# Triển khai: Duyệt truyện trước khi công khai

> **Cho người/agent thực hiện:** dùng superpowers:subagent-driven-development hoặc superpowers:executing-plans để làm lần lượt từng task. Các bước dùng checkbox (`- [ ]`).

**Mục tiêu:** truyện của tác giả (không phải quản trị viên) chỉ công khai sau khi quản trị viên duyệt; chưa duyệt / bị từ chối thì chỉ tác giả thấy trong khu Sáng tác.

**Kiến trúc:** thêm trạng thái duyệt `review` cạnh `visibility` (cột trên `stories`, kiểu cột gỡ truyện). Luật nằm ở trigger + RPC của DB và được bản giả làm y hệt. Hàng chờ của quản trị viên dùng lại `getAdminStories` (lọc `review`, sắp `submitted`).

**Công nghệ:** React 19 + TanStack Query, Ant Design (khu Quản trị), Supabase (Postgres trigger/RPC/RLS), Vitest + Testing Library.

**Spec:** [plan-duyet-truyen.md](plan-duyet-truyen.md) (đọc trước).

## Ràng buộc chung

- Chữ trên giao diện, tài liệu, commit bằng tiếng Việt; URL, tên nhánh, tham số bằng tiếng Anh (`/admin/reviews`, `?status=rejected`).
- Mỗi commit: `npm version patch --no-git-tag-version` rồi đưa `package.json` + `package-lock.json` vào cùng commit. Commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Component không gọi Supabase / `src/mocks` trực tiếp; mọi thứ qua `features/<x>/api.ts` + hook TanStack Query. `api.remote.ts` không import `@/mocks/*`.
- Prettier: không chấm phẩy, nháy đơn, `printWidth` 100. Lint bằng `npm run lint` (oxlint).
- Test mock có độ trễ: `findBy*` cần `{ timeout: 3000+ }`; điều hướng trang lazy dùng `expect.poll`.
- Migration: `supabase migration new story_review`; thử bằng transaction rollback trước; **hỏi người dùng trước khi `supabase db push` và trước khi push `main`** (cả hai đụng tới production).
- Lý do từ chối tối đa 500 ký tự (`REVIEW_REASON_MAX`).

## Điểm cần soi khi review

1. **Người dùng thường đăng truyện trong test cũ:** rất nhiều test dùng helper `publishStory` với tài khoản thường; helper phải gửi duyệt + duyệt bằng quản trị viên, nếu không cả bộ test vỡ. → Task 1 sửa helper, Task 1–2 chạy lại toàn bộ test.
2. **Dữ liệu cũ:** truyện đang/đã từng công khai không được tự dưng biến mất. → `storyReview()` (bản giả) + bước chuyển dữ liệu của migration; test "dữ liệu cũ" ở Task 1, ca SQL ở Task 5.
3. **Truyện chờ duyệt mất hết chương đã xuất bản** (tác giả ẩn/xóa chương khi đang chờ) thì quản trị viên duyệt ra truyện rỗng. → luật `last_published_chapter` mở rộng, test ở Task 1 và ca SQL ở Task 5.
4. **Gỡ rồi khôi phục** không được giữ dấu đã duyệt (phải gửi duyệt lại). → test ở Task 2, ca SQL ở Task 5.
5. **Quản trị viên xem trước** truyện chờ duyệt (trang truyện + trang đọc), người lạ thì không. → test ở Task 2 (bản giả) và ca SQL RLS ở Task 5.

---

### Task 1: Luật duyệt ở bản giả (Sáng tác) + duyệt của quản trị viên

**Files:**
- Modify: `src/types/story.ts`
- Modify: `src/mocks/userContent.ts`
- Modify: `src/features/studio/shared.ts`, `src/features/studio/api.mock.ts`, `src/features/studio/api.ts`, `src/features/studio/hooks.ts`
- Modify: `src/features/admin/shared.ts`, `src/features/admin/api.mock.ts`, `src/features/admin/api.ts`, `src/features/admin/hooks.ts`
- Modify: `src/features/studio/api.remote.ts`, `src/features/admin/api.remote.ts` (chỉ thêm hàm ném lỗi tạm để `typeof mock` khớp; ruột thật ở Task 5)
- Modify: `src/test/helpers.ts`
- Test: `src/features/studio/api.test.ts`

**Interfaces:**
- Produces:
  - `type ReviewStatus = 'pending' | 'approved' | 'rejected'`, `type StoryReview = { status; submittedAt: string | null; reviewedAt: string | null; reason: string | null }` (`@/types/story`)
  - `MyStory.review: StoryReview | null`
  - `studio.submitStoryForReview(id: string): Promise<MyStory>`; `useSubmitStoryForReview(id)`
  - `StudioErrorCode` thêm `'story_not_approved' | 'already_pending' | 'already_approved'`
  - `admin.reviewStory(input: { storyId: string; approve: boolean; reason?: string | null }): Promise<void>`; `useReviewStory()`
  - `AdminErrorCode` thêm `'not_pending' | 'reason_required'`; `REVIEW_REASON_MAX = 500`
  - `storyReview(stored)`, `pendingReview(time)`, `approvedReview(time)` (`@/mocks/userContent`)
  - Helper test: `draftStory(title?, chapters?)`, `pendingStory(title?, chapters?)`, `approveAsAdmin(storyId)`; `publishStory` tự duyệt khi người đăng không phải quản trị viên

- [ ] **Bước 1: Viết test hỏng** — thêm cuối `src/features/studio/api.test.ts`:

```ts
describe('duyệt truyện', () => {
  const pending = (time = expect.any(String)) => ({
    status: 'pending',
    submittedAt: time,
    reviewedAt: null,
    reason: null,
  })

  test('tác giả "Đăng" truyện mới thì truyện chờ duyệt, người đọc chưa thấy', async () => {
    await secondUser()
    const story = await studio.createStory(input, { chapter, publish: true })
    expect(story).toMatchObject({ visibility: 'draft', publishedCount: 1, review: pending() })
    localStorage.removeItem('mock-auth-session')
    expect(await getStory(story.slug)).toBeNull()
    expect((await getLatestUpdated()).map((s) => s.slug)).not.toContain(story.slug)
  })

  test('tác giả không tự công khai truyện chưa duyệt; gửi duyệt cần chương đã xuất bản', async () => {
    await secondUser()
    const story = await studio.createStory(input)
    await expect(studio.submitStoryForReview(story.id)).rejects.toMatchObject({
      code: 'no_published_chapters',
    })
    await studio.saveChapter(story.id, chapter, { publish: true })
    await expect(studio.publishStory(story.id)).rejects.toMatchObject({
      code: 'story_not_approved',
    })
    expect((await studio.submitStoryForReview(story.id)).review).toMatchObject(pending())
    await expect(studio.submitStoryForReview(story.id)).rejects.toMatchObject({
      code: 'already_pending',
    })
  })

  test('bị từ chối thì thấy lý do, gửi lại; duyệt rồi thì tự ẩn/hiện', async () => {
    const linh = await secondUser()
    const story = await studio.createStory(input, { chapter, publish: true })

    signInAs('demo')
    await expect(
      admin.reviewStory({ storyId: story.id, approve: false, reason: '  ' }),
    ).rejects.toMatchObject({ code: 'reason_required' })
    await admin.reviewStory({ storyId: story.id, approve: false, reason: 'Thiếu giới thiệu' })
    await expect(admin.reviewStory({ storyId: story.id, approve: true })).rejects.toMatchObject({
      code: 'not_pending',
    })

    signInAs(linh)
    expect((await studio.getMyStory(story.id))?.review).toMatchObject({
      status: 'rejected',
      reason: 'Thiếu giới thiệu',
    })
    const again = await studio.submitStoryForReview(story.id)
    expect(again.review).toMatchObject({ status: 'pending', reason: null })

    signInAs('demo')
    await admin.reviewStory({ storyId: story.id, approve: true })
    signInAs(linh)
    const approved = await studio.getMyStory(story.id)
    expect(approved).toMatchObject({ visibility: 'published', review: { status: 'approved' } })
    expect(approved?.publishedAt).not.toBeNull()
    await expect(studio.submitStoryForReview(story.id)).rejects.toMatchObject({
      code: 'already_approved',
    })
    await studio.unpublishStory(story.id)
    expect((await studio.publishStory(story.id)).visibility).toBe('published')
  })

  test('truyện chờ duyệt không ẩn/xóa được chương đã xuất bản cuối cùng', async () => {
    await secondUser()
    const story = await studio.createStory(input, { chapter, publish: true })
    await expect(studio.setChapterStatus(story.id, 1, 'draft')).rejects.toMatchObject({
      code: 'last_published_chapter',
    })
    await expect(studio.deleteChapter(story.id, 1)).rejects.toMatchObject({
      code: 'last_published_chapter',
    })
  })

  test('quản trị viên đăng là công khai ngay, không qua hàng chờ', async () => {
    signInAs('demo')
    const story = await studio.createStory(input, { chapter, publish: true })
    expect(story).toMatchObject({ visibility: 'published', review: { status: 'approved' } })
  })

  test('dữ liệu cũ (chưa có trường review): truyện đã từng công khai coi như đã duyệt', async () => {
    const linh = await secondUser()
    const old = await studio.createStory(input, { chapter, publish: true })
    // Giả dữ liệu trước khi có duyệt truyện: đã công khai, không có trường review
    const stored = JSON.parse(localStorage.getItem('mock-user-stories')!)
    stored[0] = { ...stored[0], visibility: 'published', publishedAt: stored[0].createdAt }
    delete stored[0].review
    localStorage.setItem('mock-user-stories', JSON.stringify(stored))

    signInAs(linh)
    expect((await studio.getMyStory(old.id))?.review).toMatchObject({ status: 'approved' })
    await studio.unpublishStory(old.id)
    expect((await studio.publishStory(old.id)).visibility).toBe('published')
  })
})
```

Thêm import ở đầu file: `import * as admin from '@/features/admin/api'`. Sửa `secondUser()` cho trả id (đã trả `user!.id`, giữ nguyên).

- [ ] **Bước 2: Chạy test, thấy hỏng**

Run: `npx vitest run src/features/studio/api.test.ts -t "duyệt truyện"`
Expected: FAIL (`submitStoryForReview` / `reviewStory` không tồn tại, truyện của Linh công khai ngay).

- [ ] **Bước 3: Kiểu dùng chung** — thêm vào `src/types/story.ts` sau `StoryVisibility`:

```ts
/** Trạng thái duyệt: truyện của tác giả chỉ công khai được sau khi quản trị viên duyệt */
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export type StoryReview = {
  status: ReviewStatus
  /** Lần gửi duyệt gần nhất */
  submittedAt: string | null
  /** Lúc quản trị viên duyệt / từ chối */
  reviewedAt: string | null
  /** Lý do từ chối (chỉ khi rejected) */
  reason: string | null
}
```

- [ ] **Bước 4: Bản giả lưu trạng thái duyệt** — `src/mocks/userContent.ts`: import `StoryReview`, thêm vào `StoredStory`:

```ts
  /** Trạng thái duyệt; không có (undefined) ở dữ liệu cũ, đọc qua storyReview() */
  review?: StoryReview | null
```

và thêm cuối file:

```ts
export const pendingReview = (time: string): StoryReview => ({
  status: 'pending',
  submittedAt: time,
  reviewedAt: null,
  reason: null,
})

export const approvedReview = (time: string): StoryReview => ({
  status: 'approved',
  submittedAt: null,
  reviewedAt: time,
  reason: null,
})

/**
 * Trạng thái duyệt của truyện. Dữ liệu cũ (trước khi có duyệt truyện) không có trường này: truyện đã
 * từng công khai và không bị gỡ coi như đã duyệt, giống bước chuyển dữ liệu của migration story_review.
 */
export function storyReview(story: StoredStory): StoryReview | null {
  if (story.review !== undefined) return story.review
  return story.publishedAt && !story.takedown ? approvedReview(story.publishedAt) : null
}
```

- [ ] **Bước 5: Lỗi và kiểu của khu Sáng tác** — `src/features/studio/shared.ts`:
  - `StudioErrorCode` thêm `| 'story_not_approved' | 'already_pending' | 'already_approved'`.
  - `messages` thêm:

```ts
  story_not_approved:
    'Truyện cần được ban quản trị duyệt trước khi công khai. Bấm "Gửi duyệt" để gửi truyện cho ban quản trị.',
  already_pending: 'Truyện đang chờ ban quản trị duyệt.',
  already_approved: 'Truyện đã được duyệt, bạn tự xuất bản được.',
```

  - Sửa `last_published_chapter`: `'Truyện đang công khai hoặc đang chờ duyệt cần ít nhất 1 chương đã xuất bản. Ẩn truyện trước (truyện chờ duyệt thì đợi duyệt xong) rồi mới ẩn hoặc xóa chương này.'`
  - `FirstChapterInput.publish` sửa chú thích: `/** true: xuất bản chương đó; tác giả thì gửi duyệt truyện luôn, quản trị viên thì công khai luôn */`
  - `MyStory` thêm sau `takedown` (import `StoryReview` từ `@/types/story`):

```ts
  /** Trạng thái duyệt; null: chưa gửi duyệt lần nào (hoặc bị gỡ) */
  review: StoryReview | null
```

- [ ] **Bước 6: Luật ở `src/features/studio/api.mock.ts`** — import `approvedReview, pendingReview, storyReview` từ `@/mocks/userContent`.
  - `withCounts`: thêm `review: storyReview(story),`.
  - `createStory`: thay đoạn dựng `story`:

```ts
  const publish = firstChapter?.publish ?? false
  // Tác giả: chương đầu xuất bản và truyện vào hàng chờ duyệt; quản trị viên: công khai luôn
  const live = publish && user.isAdmin
  const time = now()
  const story: StoredStory = {
    ...normalize(input),
    id: crypto.randomUUID(),
    slug: uniqueSlug(input.title),
    owner: { id: user.id, displayName: user.displayName },
    visibility: live ? 'published' : 'draft',
    createdAt: time,
    updatedAt: time,
    publishedAt: live ? time : null,
    review: live ? approvedReview(time) : publish ? pendingReview(time) : null,
  }
```

  - `publishStory` và hàm mới `submitStoryForReview`:

```ts
export async function publishStory(id: string): Promise<MyStory> {
  await delay(300)
  const { user, story, stories } = await ownStory(id)
  if (story.takedown) throw new StudioError('story_taken_down')
  if (withCounts(story).publishedCount === 0) throw new StudioError('no_published_chapters')
  const review = storyReview(story)
  // Quản trị viên miễn duyệt (trigger stories_require_review của DB)
  if (!user.isAdmin && review?.status !== 'approved') throw new StudioError('story_not_approved')
  return saveStory(stories, {
    ...story,
    visibility: 'published',
    publishedAt: story.publishedAt ?? now(),
    updatedAt: now(),
    review: review?.status === 'approved' ? review : approvedReview(now()),
  })
}

/** Gửi truyện cho ban quản trị duyệt (lần đầu, hoặc lại sau khi bị từ chối) */
export async function submitStoryForReview(id: string): Promise<MyStory> {
  await delay(300)
  const { story, stories } = await ownStory(id)
  const review = storyReview(story)
  if (story.takedown) throw new StudioError('story_taken_down')
  if (review?.status === 'pending') throw new StudioError('already_pending')
  if (review?.status === 'approved') throw new StudioError('already_approved')
  if (withCounts(story).publishedCount === 0) throw new StudioError('no_published_chapters')
  return saveStory(stories, { ...story, review: pendingReview(now()), updatedAt: now() })
}
```

  - `guardLastPublished`:

```ts
/** Chặn làm truyện đang công khai hoặc đang chờ duyệt mất hết chương đã xuất bản */
function guardLastPublished(story: StoredStory, chapters: Chapter[], chapter: Chapter) {
  const publishedCount = chapters.filter((c) => c.status === 'published').length
  const live = story.visibility === 'published' || storyReview(story)?.status === 'pending'
  if (live && chapter.status === 'published' && publishedCount === 1) {
    throw new StudioError('last_published_chapter')
  }
}
```

  - `src/features/studio/api.ts`: thêm `submitStoryForReview,` vào danh sách export (sau `unpublishStory`).
  - `src/features/studio/api.remote.ts`: thêm tạm (Task 5 thay ruột):

```ts
export async function submitStoryForReview(_id: string): Promise<MyStory> {
  throw new Error('submitStoryForReview: chưa nối Supabase')
}
```

  và trong `toMyStory` thêm `review: null,` (Task 5 map cột thật).
  - `src/features/studio/hooks.ts` thêm sau `useSetStoryVisibility`:

```ts
export function useSubmitStoryForReview(id: string) {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: () => api.submitStoryForReview(id), onSuccess: invalidate })
}
```

- [ ] **Bước 7: Duyệt / từ chối ở bản giả của Quản trị** — `src/features/admin/shared.ts`:
  - `AdminErrorCode` thêm `| 'not_pending' | 'reason_required'`; `adminMessages` thêm:

```ts
  not_pending:
    'Truyện này không còn chờ duyệt. Có thể quản trị viên khác vừa xử lý hoặc truyện vừa bị gỡ.',
  reason_required: 'Nhập lý do từ chối để tác giả biết cần sửa gì.',
```

  - Thêm:

```ts
/** Độ dài tối đa của lý do từ chối (cột stories.review_reason) */
export const REVIEW_REASON_MAX = 500

export type ReviewInput = {
  storyId: string
  /** true: duyệt và công khai luôn; false: từ chối (bắt buộc lý do) */
  approve: boolean
  reason?: string | null
}
```

  `src/features/admin/api.mock.ts`: import `storyReview` từ `@/mocks/userContent`, `type ReviewInput` từ `./shared`; thêm sau `setStoryTakedown`:

```ts
/** Duyệt (công khai luôn) hoặc từ chối (kèm lý do) truyện đang chờ duyệt */
export async function reviewStory({ storyId, approve, reason }: ReviewInput) {
  await delay()
  await requireAdmin()
  const stories = loadUserStories()
  const story = stories.find((s) => s.id === storyId)
  if (!story) throw new AdminError('not_found')
  const review = storyReview(story)
  if (review?.status !== 'pending') throw new AdminError('not_pending')
  const text = reason?.trim() ?? ''
  if (!approve && !text) throw new AdminError('reason_required')
  const time = new Date().toISOString()
  saveUserStories(
    stories.map((s) =>
      s.id !== storyId
        ? s
        : approve
          ? {
              ...s,
              visibility: 'published' as const,
              publishedAt: s.publishedAt ?? time,
              updatedAt: time,
              review: { ...review, status: 'approved' as const, reviewedAt: time, reason: null },
            }
          : {
              ...s,
              updatedAt: time,
              review: { ...review, status: 'rejected' as const, reviewedAt: time, reason: text },
            },
    ),
  )
}
```

  Trong `setStoryTakedown` của bản giả, nhánh gỡ thêm `review: null,`; nhánh khôi phục đổi thành `{ ...s, takedown: null, review: storyReview(s) }` (đọc khi truyện còn bị gỡ nên là null: dữ liệu cũ không tự thành đã duyệt).
  - `src/features/admin/api.ts`: thêm `reviewStory,` sau `setStoryTakedown`.
  - `src/features/admin/api.remote.ts`: thêm tạm `export async function reviewStory(_input: ReviewInput): Promise<void> { throw new Error('reviewStory: chưa nối Supabase') }` (import `type ReviewInput`).
  - `src/features/admin/hooks.ts` thêm:

```ts
/** Duyệt / từ chối truyện: làm mới cả danh sách công khai (truyện vừa duyệt hiện ra ngay) */
export function useReviewStory() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (input: api.ReviewInput) => api.reviewStory(input),
    onSettled: () =>
      Promise.all(
        [adminKeys.all(userId), ['stories'], ['chapters'], ['genres']].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
```

- [ ] **Bước 8: Helper test** — `src/test/helpers.ts`: import `getSession` từ `@/features/auth/api`, `reviewStory` từ `@/features/admin/api`; thay `publishStory` bằng:

```ts
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
```

- [ ] **Bước 9: Sửa test cũ bị đổi luật** — `src/features/admin/api.test.ts`, test "gỡ truyện…", thay 2 dòng cuối:

```ts
  signInAs(linh)
  // Gỡ làm mất dấu đã duyệt: khôi phục xong phải gửi duyệt lại
  await expect(studio.publishStory(story.id)).rejects.toMatchObject({ code: 'story_not_approved' })
  expect((await studio.submitStoryForReview(story.id)).review?.status).toBe('pending')
```

  Và `src/features/studio/api.remote.test.ts`: kỳ vọng `toEqual` của test "tạo truyện…" thêm `review: null,`.

- [ ] **Bước 10: Chạy test**

Run: `npx vitest run src/features/studio src/features/admin && npm run typecheck`
Expected: PASS. Sau đó `npm test` (toàn bộ) để chắc helper mới không làm vỡ test khác; test nào dựa vào câu báo `last_published_chapter` cũ thì sửa theo câu mới.

- [ ] **Bước 11: Commit**

```bash
npm version patch --no-git-tag-version
git add -A src package.json package-lock.json
git commit -m "Duyệt truyện: luật gửi duyệt, duyệt/từ chối ở bản giả

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Bản giả Quản trị: hàng chờ, số liệu, xem trước

**Files:**
- Modify: `src/features/admin/shared.ts`, `src/features/admin/api.mock.ts`
- Modify: `src/mocks/catalog.ts`, `src/features/stories/api.mock.ts`, `src/features/chapters/api.mock.ts`
- Modify: `src/features/admin/api.remote.ts` (map tạm `review: null, authorName: null, genreSlugs: []`; Task 5 thay)
- Test: `src/features/admin/api.test.ts`

**Interfaces:**
- Consumes: `storyReview`, `reviewStory`, `pendingStory` (Task 1)
- Produces:
  - `AdminStory` thêm `review: StoryReview | null`, `authorName: string | null`, `genreSlugs: string[]`
  - `AdminStoryQuery.review?: 'pending' | 'rejected'`; `ADMIN_STORY_SORTS` thêm `'submitted'`
  - `AdminOverview.totals.pendingReviews: number`
  - `catalog(viewerId, isAdmin = false)`, `findStory(slug, viewerId, isAdmin = false)`

- [ ] **Bước 1: Viết test hỏng** — thêm vào `src/features/admin/api.test.ts` (import `pendingStory` từ `@/test/helpers`):

```ts
test('duyệt truyện: hàng chờ theo lúc gửi, xem trước, số liệu, duyệt thì công khai', async () => {
  const { getStory } = await import('@/features/stories/api')
  const { getChapter } = await import('@/features/chapters/api')
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const a = await pendingStory('Mùa Hạ Năm Ấy')
  await studio.updateStory(a.id, {
    title: 'Mùa Hạ Năm Ấy',
    description: 'Một câu chuyện tình học trò nhẹ nhàng, kết thúc có hậu.',
    genreSlugs: ['ngon-tinh'],
    status: 'ongoing',
    coverUrl: null,
    authorName: 'Bút danh Lá',
  })
  const b = await pendingStory('Gió Qua Hiên Nhà')

  // Người lạ không thấy truyện chờ duyệt
  signOut()
  expect(await getStory(a.slug)).toBeNull()

  signInAs('demo')
  // Quản trị viên xem trước được truyện và chương đã xuất bản của nó
  expect(await getStory(a.slug)).toMatchObject({ visibility: 'draft' })
  expect(await getChapter(a.slug, 1)).toMatchObject({ number: 1 })

  const queue = await admin.getAdminStories({
    review: 'pending',
    sort: 'submitted',
    order: 'asc',
    page: 1,
  })
  expect(queue.items.map((s) => s.title)).toEqual(['Mùa Hạ Năm Ấy', 'Gió Qua Hiên Nhà'])
  expect(queue.items[0]).toMatchObject({
    ownerId: linh,
    authorName: 'Bút danh Lá',
    genreSlugs: ['ngon-tinh'],
    review: { status: 'pending' },
  })
  expect((await admin.getAdminOverview(7)).totals.pendingReviews).toBe(2)

  await admin.reviewStory({ storyId: a.id, approve: true })
  await admin.reviewStory({ storyId: b.id, approve: false, reason: 'Bìa vi phạm' })
  expect((await admin.getAdminOverview(7)).totals.pendingReviews).toBe(0)
  const rejected = await admin.getAdminStories({ review: 'rejected', page: 1 })
  expect(rejected.items).toEqual([
    expect.objectContaining({ title: 'Gió Qua Hiên Nhà', review: expect.objectContaining({ reason: 'Bìa vi phạm' }) }),
  ])

  signOut()
  expect(await getStory(a.slug)).toMatchObject({ visibility: 'published' })
  expect(await getStory(b.slug)).toBeNull()
})

test('gỡ truyện đang chờ duyệt thì rời hàng chờ; người thường không duyệt được', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await pendingStory('Mùa Hạ Năm Ấy')
  await expect(admin.reviewStory({ storyId: story.id, approve: true })).rejects.toBeInstanceOf(
    admin.AdminError,
  )
  signInAs('demo')
  await admin.setStoryTakedown(story.id, 'Đạo văn')
  expect((await admin.getAdminStories({ review: 'pending', page: 1 })).total).toBe(0)
  await expect(admin.reviewStory({ storyId: story.id, approve: true })).rejects.toMatchObject({
    code: 'not_pending',
  })
})
```

- [ ] **Bước 2: Chạy test, thấy hỏng**

Run: `npx vitest run src/features/admin/api.test.ts -t "duyệt truyện|rời hàng chờ"`
Expected: FAIL (`getStory` của quản trị viên trả null; không có `review` trong `AdminStory`).

- [ ] **Bước 3: Kiểu** — `src/features/admin/shared.ts`:
  - import `StoryReview` từ `@/types/story`.
  - `AdminStory` thêm sau `takedown`:

```ts
  /** Trạng thái duyệt; truyện có sẵn của bản giả luôn là đã duyệt */
  review: StoryReview | null
  /** Bút danh; null: hiển thị tên tài khoản */
  authorName: string | null
  genreSlugs: string[]
```

  - `ADMIN_STORY_SORTS` thêm `'submitted'` (cuối mảng).
  - `AdminStoryQuery` thêm:

```ts
  /** Trạng thái duyệt (hàng chờ /admin/reviews và bộ lọc "Duyệt" của bảng Truyện) */
  review?: 'pending' | 'rejected'
```

  - `AdminOverview.totals` thêm `/** Số truyện đang chờ duyệt */ pendingReviews: number`.

- [ ] **Bước 4: `src/features/admin/api.mock.ts`**
  - Truyện có sẵn (`seeds`): thêm `review: SEED_REVIEW, authorName: null, genreSlugs: s.genres.map((g) => g.slug),` với hằng `const SEED_REVIEW = approvedReview('2026-01-01T00:00:00.000Z')` (import `approvedReview`).
  - Truyện người dùng (`mine`): thêm `review: storyReview(stored), authorName: stored.authorName ?? null, genreSlugs: stored.genreSlugs,`.
  - `storySortKeys`: kiểu trả về đổi thành `string | number | null`, thêm `submitted: (s) => s.review?.submittedAt ?? null,`.
  - `getAdminStories`: nhận thêm `review` và thêm điều kiện lọc `(!review || s.review?.status === review) &&`.
  - `getAdminOverview` → `totals` thêm `pendingReviews: stories.filter((s) => s.review?.status === 'pending').length,`.
  - `src/features/admin/api.remote.ts`, trong map của `getAdminStories` thêm tạm `review: null, authorName: null, genreSlugs: [],` (Task 5 map cột thật).

- [ ] **Bước 5: Quản trị viên xem trước truyện chờ duyệt** — `src/mocks/catalog.ts`: import `storyReview`; đổi

```ts
/**
 * Truyện người xem được thấy: truyện công khai, cộng truyện nháp của chính họ (để xem trước); quản
 * trị viên thấy thêm truyện đang chờ duyệt (đọc trước khi duyệt). viewerId = null: người lạ.
 */
export function catalog(viewerId: string | null = null, isAdmin = false): Story[] {
  const genres = allGenres()
  const views = loadViews()
  const mine = loadUserStories()
    .filter(
      (s) =>
        s.visibility === 'published' ||
        s.owner.id === viewerId ||
        (isAdmin && storyReview(s)?.status === 'pending'),
    )
    .map((s) => toStory(s, genres, views))
  return [...seedStories, ...mine]
}

export const findStory = (slug: string, viewerId: string | null = null, isAdmin = false) =>
  catalog(viewerId, isAdmin).find((s) => s.slug === slug) ?? null
```

  Ở `src/features/stories/api.mock.ts` (`getStory`) và 3 chỗ trong `src/features/chapters/api.mock.ts` đổi `findStory(slug, viewer?.id ?? null)` thành `findStory(slug, viewer?.id ?? null, viewer?.isAdmin)`.

- [ ] **Bước 6: Chạy test**

Run: `npx vitest run src/features/admin src/features/stories src/features/chapters && npm run typecheck`
Expected: PASS.

- [ ] **Bước 7: Commit** (như Task 1, message `Duyệt truyện: hàng chờ, số liệu và xem trước cho quản trị viên ở bản giả`).

---

### Task 3: Giao diện Sáng tác

**Files:**
- Modify: `src/features/studio/components/StatusBadge.tsx`, `src/pages/studio/StudioPage.tsx`, `src/pages/studio/ManageStoryPage.tsx`
- Modify: `src/features/studio/components/StoryForm.tsx`, `src/pages/studio/NewStoryPage.tsx`
- Modify: `src/features/admin/admin-flow.test.tsx` (test gỡ truyện: nút giờ là "Gửi duyệt")
- Test: `src/features/studio/studio-flow.test.tsx`

**Interfaces:**
- Consumes: `MyStory.review`, `useSubmitStoryForReview` (Task 1), `useSession` (`@/features/auth/hooks`)
- Produces: `StatusBadge` nhận thêm `review?: ReviewStatus | null`; `StoryForm` nhận thêm `publishLabel?: string`

- [ ] **Bước 1: Viết test hỏng** — thêm vào `src/features/studio/studio-flow.test.tsx` (import `approveAsAdmin, registerUser, signInAs` từ `@/test/helpers` và `reviewStory` từ `@/features/admin/api`):

```ts
test('tác giả mới: "Đăng và gửi duyệt" thì chờ duyệt; bị từ chối thì thấy lý do và gửi lại', async () => {
  const linh = await registerUser('Linh', 'linh@gmail.com')
  const { router, user } = renderApp('/studio/new-story?genre=ngon-tinh')
  expect(await screen.findByText(/Đăng và gửi duyệt/, { selector: 'p' }, slow)).toBeInTheDocument()
  await user.type(screen.getByLabelText('Tên truyện'), 'Gió Mùa Thu')
  await user.type(
    screen.getByLabelText('Giới thiệu'),
    'Một câu chuyện tình học trò nhẹ nhàng giữa hai người bạn cùng bàn.',
  )
  await user.type(screen.getByLabelText('Tiêu đề chương'), 'Gặp lại')
  await writeInEditor(user, screen.getByLabelText('Nội dung chương'), content)
  await user.click(screen.getByRole('button', { name: 'Đăng và gửi duyệt' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Gió Mùa Thu' }, slow))
  expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
  expect(screen.getByText(/đang chờ ban quản trị duyệt/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Xuất bản truyện' })).not.toBeInTheDocument()
  const storyId = router.state.location.pathname.split('/').at(-1)!

  // Quản trị viên từ chối
  signInAs('demo')
  await reviewStory({ storyId, approve: false, reason: 'Giới thiệu quá ngắn' })
  signInAs(linh)
  await router.navigate('/studio')
  await router.navigate(`/studio/story/${storyId}`)
  expect(await screen.findByText(/Giới thiệu quá ngắn/, {}, slow)).toBeInTheDocument()
  expect(screen.getByText('Bị từ chối')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Gửi duyệt lại' }))
  expect(await screen.findByText('Chờ duyệt', {}, slow)).toBeInTheDocument()

  // Duyệt xong: tác giả tự ẩn / hiện
  await approveAsAdmin(storyId)
  await router.navigate('/studio')
  await router.navigate(`/studio/story/${storyId}`)
  expect(await screen.findByRole('button', { name: 'Ẩn truyện' }, slow)).toBeInTheDocument()
})

test('truyện chưa gửi duyệt: nút "Gửi duyệt" mở khi có chương đã xuất bản', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const { draftStory } = await import('@/test/helpers')
  const story = await draftStory('Mùa Hạ Năm Ấy', 1)
  const { user } = renderApp(`/studio/story/${story.id}`)
  const submit = await screen.findByRole('button', { name: 'Gửi duyệt' }, slow)
  expect(screen.getByText(/cần ban quản trị duyệt trước khi công khai/)).toBeInTheDocument()
  await user.click(submit)
  expect(await screen.findByText('Chờ duyệt', {}, slow)).toBeInTheDocument()
})
```

  (`router.navigate` qua `/studio` rồi quay lại để trang tải lại dữ liệu đã đổi ngoài React Query.)

- [ ] **Bước 2: Chạy test, thấy hỏng**

Run: `npx vitest run src/features/studio/studio-flow.test.tsx -t "duyệt"`
Expected: FAIL (không có nút "Đăng và gửi duyệt").

- [ ] **Bước 3: `StatusBadge`** — thay toàn bộ `src/features/studio/components/StatusBadge.tsx`:

```tsx
import { cn } from '@/lib/utils'
import type { ReviewStatus } from '@/types/story'

export function StatusBadge({
  published,
  takenDown = false,
  review = null,
  className,
}: {
  published: boolean
  /** Truyện bị ban quản trị gỡ */
  takenDown?: boolean
  /** Trạng thái duyệt của truyện (chỉ hiện khi truyện chưa xuất bản) */
  review?: ReviewStatus | null
  className?: string
}) {
  const [label, tone] = takenDown
    ? ['Bị gỡ', 'bg-destructive/15 text-destructive']
    : published
      ? ['Đã xuất bản', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300']
      : review === 'pending'
        ? ['Chờ duyệt', 'bg-amber-500/15 text-amber-700 dark:text-amber-300']
        : review === 'rejected'
          ? ['Bị từ chối', 'bg-destructive/15 text-destructive']
          : ['Nháp', 'bg-muted text-muted-foreground']
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone,
        className,
      )}
    >
      {label}
    </span>
  )
}
```

  (Giữ nguyên dòng import `cn` như file cũ.) `StudioPage.tsx` (2 chỗ) và `ManageStoryPage.tsx` (1 chỗ) truyền thêm `review={s.review?.status}` / `review={story.review?.status}`.

- [ ] **Bước 4: `PublishControls`** trong `src/pages/studio/ManageStoryPage.tsx` — import `useSession` từ `@/features/auth/hooks`, `useSubmitStoryForReview`; thay hàm:

```tsx
function PublishControls({ story }: { story: MyStory }) {
  const { data: viewer } = useSession()
  const visibility = useSetStoryVisibility(story.id)
  const submit = useSubmitStoryForReview(story.id)
  const published = story.visibility === 'published'
  const review = story.review?.status ?? null
  // Quản trị viên miễn duyệt; truyện đã duyệt thì tác giả tự xuất bản / ẩn
  const approved = !!viewer?.isAdmin || review === 'approved'
  const hasChapter = story.publishedCount > 0
  const canPublish = hasChapter && !story.takedown
  // Gợi ý "cần xuất bản chương" (truyện bị gỡ thì đã có thông báo riêng ở trên)
  const needsChapter = !story.takedown && !hasChapter
  const error = visibility.error ?? submit.error

  return (
    <div className="space-y-3">
      {story.takedown && (
        <FormAlert>
          <strong>Truyện đã bị ban quản trị gỡ:</strong> {story.takedown.reason}
          <br />
          Người đọc không còn thấy truyện và bạn chưa xuất bản lại được. Nếu cho rằng đây là nhầm
          lẫn, hãy gửi tin nhắn ở trang <Link to={paths.contact}>Liên hệ</Link>.
        </FormAlert>
      )}
      {!published && review === 'rejected' && (
        <FormAlert>
          <strong>Truyện chưa được duyệt:</strong> {story.review?.reason}
          <br />
          Sửa theo góp ý rồi bấm "Gửi duyệt lại".
        </FormAlert>
      )}
      {!published && review === 'pending' && (
        <p role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          Truyện đang chờ ban quản trị duyệt
          {story.review?.submittedAt && ` (gửi ${formatRelativeTime(story.review.submittedAt)})`}.
          Bạn vẫn sửa truyện và viết thêm chương được; duyệt xong truyện tự công khai.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {published ? (
          <Button
            variant="outline"
            className="h-10 rounded-full px-5"
            disabled={visibility.isPending}
            onClick={() => visibility.mutate(false)}
          >
            Ẩn truyện
          </Button>
        ) : approved ? (
          <Button
            className="h-10 rounded-full px-5"
            disabled={!canPublish || visibility.isPending}
            aria-describedby={needsChapter ? 'publish-hint' : undefined}
            onClick={() => visibility.mutate(true)}
          >
            Xuất bản truyện
          </Button>
        ) : (
          review !== 'pending' && (
            <Button
              className="h-10 rounded-full px-5"
              disabled={!canPublish || submit.isPending}
              aria-describedby={needsChapter ? 'publish-hint' : 'review-hint'}
              onClick={() => submit.mutate()}
            >
              {review === 'rejected' ? 'Gửi duyệt lại' : 'Gửi duyệt'}
            </Button>
          )
        )}
        <Button asChild variant="ghost" className="h-10 rounded-full px-4">
          <Link to={paths.story(story.slug)}>
            <ExternalLink />
            {published ? 'Xem trang truyện' : 'Xem trước'}
          </Link>
        </Button>
      </div>
      {!published && needsChapter && review !== 'pending' && (
        <p id="publish-hint" className="text-sm text-muted-foreground">
          Xuất bản ít nhất 1 chương để có thể {approved ? 'xuất bản truyện' : 'gửi duyệt'}.
        </p>
      )}
      {!published && !approved && review === null && !story.takedown && (
        <p id="review-hint" className="text-sm text-muted-foreground">
          Truyện mới cần ban quản trị duyệt trước khi công khai. Trong lúc chờ, bạn vẫn sửa truyện
          và viết thêm chương được.
        </p>
      )}
      {error && <FormAlert>{studioErrorMessage(error)}</FormAlert>}
      {visibility.isSuccess && (
        <FormAlert variant="success">
          {published
            ? 'Truyện đã công khai. Mọi người có thể tìm và đọc truyện của bạn.'
            : 'Đã ẩn truyện. Chỉ bạn thấy truyện này.'}
        </FormAlert>
      )}
    </div>
  )
}
```

- [ ] **Bước 5: Form tạo truyện** — `StoryForm.tsx`: thêm prop `/** Nhãn nút đăng (form truyện mới) */ publishLabel?: string` (mặc định `'Đăng truyện'`), nút đăng hiện `{publishLabel}`; sửa chú thích `publish` thành "Bấm nút đăng: xuất bản chương đầu tiên; tác giả thì gửi duyệt truyện, quản trị viên thì công khai luôn". `NewStoryPage.tsx`:

```tsx
  const isAdmin = !!user?.isAdmin
  const publishLabel = isAdmin ? 'Đăng truyện' : 'Đăng và gửi duyệt'
```

  đoạn giới thiệu:

```tsx
      <p className="mt-1 mb-8 max-w-prose text-muted-foreground">
        Điền thông tin truyện và viết luôn chương đầu tiên nếu muốn. "Lưu nháp" để viết tiếp sau,{' '}
        {isAdmin
          ? '"Đăng truyện" để công khai ngay.'
          : '"Đăng và gửi duyệt" để xuất bản chương đầu và gửi truyện cho ban quản trị duyệt (duyệt xong truyện mới công khai).'}
      </p>
```

  và truyền `publishLabel={publishLabel}` cho `StoryForm`.

- [ ] **Bước 6: Sửa test cũ** — `src/features/admin/admin-flow.test.tsx`, test "khóa người dùng và gỡ truyện…": dòng cuối đổi thành `expect(screen.getByRole('button', { name: 'Gửi duyệt' })).toBeDisabled()`.

- [ ] **Bước 7: Chạy test**

Run: `npx vitest run src/features/studio src/features/admin/admin-flow.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Bước 8: Commit** (`Duyệt truyện: giao diện Sáng tác (gửi duyệt, chờ duyệt, bị từ chối)`).

---

### Task 4: Giao diện Quản trị + dải xem trước trên trang truyện

**Files:**
- Create: `src/pages/admin/AdminReviewsPage.tsx`
- Modify: `src/lib/routes.ts`, `src/app/router.tsx`, `src/features/admin/components/AdminLayout.tsx`
- Modify: `src/pages/admin/AdminDashboardPage.tsx`, `src/pages/admin/AdminStoriesPage.tsx`
- Modify: `src/pages/StoryDetailPage.tsx`
- Test: `src/features/admin/admin-flow.test.tsx`

**Interfaces:**
- Consumes: `useAdminStories({ review, sort: 'submitted' })`, `useReviewStory`, `REVIEW_REASON_MAX`, `AdminStory.review/authorName/genreSlugs`, `totals.pendingReviews` (Task 1–2)
- Produces: `paths.adminReviews = '/admin/reviews'`

- [ ] **Bước 1: Viết test hỏng** — thêm vào `src/features/admin/admin-flow.test.tsx` (import `pendingStory` từ `@/test/helpers`):

```ts
test('duyệt truyện: từ Tổng quan vào hàng chờ, duyệt một truyện, từ chối một truyện', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  await pendingStory('Mùa Hạ Năm Ấy')
  await pendingStory('Gió Qua Hiên Nhà')
  signInAs('demo')
  const { router, user } = renderApp('/admin')

  expect(
    await screen.findByText('Truyện chờ duyệt', { selector: '.ant-statistic-title' }, slow),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: /Mở hàng chờ/ }))
  expect(await screen.findByRole('heading', { name: 'Duyệt truyện' }, slow)).toBeInTheDocument()
  const row = (title: string) => screen.getByText(title, { selector: 'strong' }).closest('tr')!
  await screen.findByText('Mùa Hạ Năm Ấy', { selector: 'strong' }, slow)
  expect(within(row('Mùa Hạ Năm Ấy')).getByRole('link', { name: /Xem trước/ })).toHaveAttribute(
    'href',
    '/story/mua-ha-nam-ay',
  )

  // Duyệt
  await user.click(within(row('Mùa Hạ Năm Ấy')).getByRole('button', { name: 'Duyệt' }))
  const popconfirm = (await screen.findByText(/Duyệt "Mùa Hạ Năm Ấy"/, {}, slow)).closest(
    '.ant-popover',
  )!
  await user.click(within(popconfirm as HTMLElement).getByRole('button', { name: 'Duyệt' }))
  await expect
    .poll(() => screen.queryByText('Mùa Hạ Năm Ấy', { selector: 'strong' }), slow)
    .toBeNull()

  // Từ chối: bắt buộc lý do
  await user.click(within(row('Gió Qua Hiên Nhà')).getByRole('button', { name: 'Từ chối' }))
  const dialog = await screen.findByRole('dialog', {}, slow)
  const confirm = within(dialog).getByRole('button', { name: 'Từ chối' })
  expect(confirm).toBeDisabled()
  await user.type(within(dialog).getByLabelText('Lý do từ chối'), 'Bìa vi phạm')
  await user.click(confirm)
  await expect
    .poll(() => screen.queryByText('Gió Qua Hiên Nhà', { selector: 'strong' }), slow)
    .toBeNull()

  // Tab "Bị từ chối" có lý do
  await user.click(screen.getByText('Bị từ chối', { selector: '.ant-segmented-item-label' }))
  await expect.poll(() => router.state.location.search, slow).toBe('?status=rejected')
  expect(await screen.findByText('Bìa vi phạm', {}, slow)).toBeInTheDocument()

  // Bảng Truyện: lọc "Chờ duyệt" không còn truyện nào, truyện vừa duyệt công khai
  await router.navigate('/admin/stories?review=rejected')
  expect(await screen.findByText('Bị từ chối', { selector: '.ant-tag' }, slow)).toBeInTheDocument()
})

test('quản trị viên xem trước truyện chờ duyệt: có dải "chưa công khai"', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  const story = await pendingStory('Mùa Hạ Năm Ấy')
  signInAs('demo')
  renderApp(`/story/${story.slug}`)
  expect(await screen.findByText(/truyện chưa công khai/i, {}, slow)).toBeInTheDocument()
})
```

- [ ] **Bước 2: Chạy test, thấy hỏng**

Run: `npx vitest run src/features/admin/admin-flow.test.tsx -t "duyệt|xem trước"`
Expected: FAIL (không có ô "Truyện chờ duyệt").

- [ ] **Bước 3: Đường dẫn, route, menu**
  - `src/lib/routes.ts` sau `adminStories`: `adminReviews: '/admin/reviews',`
  - `src/app/router.tsx` sau route `stories`: `{ path: 'reviews', lazy: page(() => import('@/pages/admin/AdminReviewsPage')) },`
  - `AdminLayout.tsx`: import `ClipboardCheck` từ `lucide-react`, thêm sau mục "Truyện": `{ key: paths.adminReviews, icon: ClipboardCheck, label: 'Duyệt truyện' },`

- [ ] **Bước 4: Trang `src/pages/admin/AdminReviewsPage.tsx`**

```tsx
import { Alert, App, Button, Card, Grid, Input, Modal, Popconfirm, Segmented, Table } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { SITE_NAME } from '@/config/site'
import { type AdminStory, adminErrorMessage, REVIEW_REASON_MAX } from '@/features/admin/api'
import { ClearFilters } from '@/features/admin/components/TableFilters'
import {
  onTableChange,
  readTableParams,
  sortable,
  tablePagination,
} from '@/features/admin/components/tableParams'
import { useFilterParams } from '@/features/admin/components/useFilterParams'
import { useAdminStories, useReviewStory } from '@/features/admin/hooks'
import { useGenres } from '@/features/genres/hooks'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { paths } from '@/lib/routes'

const number = new Intl.NumberFormat('vi-VN')
const SORTS = ['submitted', 'title'] as const

export default function AdminReviewsPage() {
  const { params, page, update } = useFilterParams()
  const screens = Grid.useBreakpoint()
  const pinFirst = screens.md ?? false
  const pinActions = screens.lg ?? false
  const q = params.get('q') ?? ''
  const status = params.get('status') === 'rejected' ? 'rejected' : 'pending'
  const { sort, order, pageSize } = readTableParams(params, SORTS)
  // Mặc định: gửi trước xếp trước (hàng chờ); không ghi lên URL
  const active = sort ? { sort, order } : { sort: 'submitted' as const, order: 'asc' as const }
  const { data, isPending, isFetching, isError } = useAdminStories({
    q,
    review: status,
    sort: active.sort,
    order: active.order,
    page,
    pageSize,
  })
  const genres = useGenres()
  const genreName = (slug: string) => genres.data?.find((g) => g.slug === slug)?.name ?? slug
  const review = useReviewStory()
  const { message } = App.useApp()
  // Truyện đang mở hộp thoại từ chối và lý do đang nhập
  const [rejecting, setRejecting] = useState<AdminStory | null>(null)
  const [reason, setReason] = useState('')

  const decide = (story: AdminStory, approve: boolean, text?: string) =>
    review.mutate(
      { storyId: story.id, approve, reason: text },
      {
        onSuccess: () => {
          setRejecting(null)
          void message.success(
            approve ? `Đã duyệt "${story.title}", truyện đã công khai.` : `Đã từ chối "${story.title}".`,
          )
        },
        onError: (error) => void message.error(adminErrorMessage(error)),
      },
    )

  return (
    <div className="space-y-6">
      <title>{`Duyệt truyện · Quản trị | ${SITE_NAME}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">Duyệt truyện</h1>
        {data && (
          <p className="text-sm text-muted-foreground">
            {number.format(data.total)} truyện {status === 'pending' ? 'chờ duyệt' : 'bị từ chối'}
          </p>
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            key={q}
            defaultValue={q}
            placeholder="Tìm theo tên truyện hoặc tác giả"
            aria-label="Tìm truyện"
            allowClear
            className="max-w-sm"
            onSearch={(value) => update({ q: value.trim() })}
          />
          <Segmented
            value={status}
            onChange={(value) => update({ status: value === 'pending' ? null : value })}
            options={[
              { label: 'Chờ duyệt', value: 'pending' },
              { label: 'Bị từ chối', value: 'rejected' },
            ]}
            aria-label="Lọc theo trạng thái duyệt"
          />
          <ClearFilters params={params} keys={['q']} update={update} />
        </div>

        {isError ? (
          <Alert type="error" showIcon title="Không tải được hàng chờ duyệt." />
        ) : (
          <Table<AdminStory>
            rowKey="id"
            loading={isPending || isFetching}
            dataSource={data?.items}
            scroll={{ x: status === 'pending' ? 1000 : 1280 }}
            locale={{
              emptyText:
                status === 'pending' ? 'Không có truyện nào đang chờ duyệt' : 'Chưa từ chối truyện nào',
            }}
            pagination={tablePagination(data, page, pageSize, update)}
            onChange={onTableChange(update)}
            columns={[
              {
                title: 'Truyện',
                ...sortable('title', active),
                dataIndex: 'title',
                fixed: pinFirst ? 'left' : undefined,
                width: pinFirst ? 260 : 200,
                render: (title: string, s) => (
                  <div className="min-w-0">
                    <strong className="block truncate font-medium" title={title}>
                      {title}
                    </strong>
                    <Link
                      to={paths.story(s.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs"
                      aria-label={`Xem trước ${title} (mở tab mới)`}
                    >
                      Xem trước ↗
                    </Link>
                  </div>
                ),
              },
              {
                title: 'Tác giả',
                width: 180,
                render: (_, s) => (
                  <div className="min-w-0">
                    {s.ownerId ? (
                      <Link to={paths.adminStories(s.ownerId)} className="block truncate">
                        {s.ownerName}
                      </Link>
                    ) : (
                      s.ownerName
                    )}
                    {s.authorName && (
                      <span className="block truncate text-xs text-muted-foreground">
                        Bút danh: {s.authorName}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                title: 'Thể loại',
                width: 200,
                render: (_, s) => s.genreSlugs.map(genreName).join(', ') || '–',
              },
              {
                title: 'Chương',
                width: 100,
                align: 'right',
                render: (_, s) => (
                  <span title="Đã xuất bản / tổng số chương">
                    {number.format(s.publishedCount)}/{number.format(s.chapterCount)}
                  </span>
                ),
              },
              {
                title: 'Gửi lúc',
                ...sortable('submitted', active),
                // Mặc định đang tăng dần: bấm thì sang giảm dần trước
                sortDirections: ['ascend', 'descend'],
                width: 140,
                render: (_, s) =>
                  s.review?.submittedAt ? (
                    <span title={formatDate(s.review.submittedAt)}>
                      {formatRelativeTime(s.review.submittedAt)}
                    </span>
                  ) : (
                    '–'
                  ),
              },
              ...(status === 'rejected'
                ? [
                    {
                      title: 'Lý do từ chối',
                      width: 280,
                      render: (_: unknown, s: AdminStory) => s.review?.reason,
                    },
                    {
                      title: 'Từ chối lúc',
                      width: 130,
                      render: (_: unknown, s: AdminStory) =>
                        s.review?.reviewedAt ? formatDate(s.review.reviewedAt) : '–',
                    },
                  ]
                : [
                    {
                      title: 'Thao tác',
                      key: 'actions',
                      width: 180,
                      fixed: pinActions ? ('right' as const) : undefined,
                      className: 'whitespace-nowrap',
                      render: (_: unknown, s: AdminStory) => (
                        <div className="flex gap-2">
                          <Popconfirm
                            title={`Duyệt "${s.title}"?`}
                            description="Truyện công khai ngay sau khi duyệt."
                            okText="Duyệt"
                            cancelText="Hủy"
                            onConfirm={() => decide(s, true)}
                          >
                            <Button
                              size="small"
                              type="primary"
                              loading={review.isPending && review.variables?.storyId === s.id}
                            >
                              Duyệt
                            </Button>
                          </Popconfirm>
                          <Button
                            size="small"
                            danger
                            onClick={() => {
                              setReason('')
                              setRejecting(s)
                            }}
                          >
                            Từ chối
                          </Button>
                        </div>
                      ),
                    },
                  ]),
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!rejecting}
        title={rejecting && `Từ chối truyện "${rejecting.title}"`}
        okText="Từ chối"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: review.isPending }}
        cancelText="Hủy"
        onOk={() => rejecting && decide(rejecting, false, reason)}
        onCancel={() => setRejecting(null)}
        destroyOnHidden
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Truyện vẫn là nháp. Tác giả thấy lý do này trong khu Sáng tác, sửa rồi gửi duyệt lại.
        </p>
        <label htmlFor="reject-reason" className="mb-1 block text-sm font-medium">
          Lý do từ chối
        </label>
        <Input.TextArea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REVIEW_REASON_MAX}
          showCount
          autoSize={{ minRows: 3 }}
          placeholder="Ví dụ: Ảnh bìa có nội dung không phù hợp, đổi ảnh khác rồi gửi lại."
        />
      </Modal>
    </div>
  )
}
```


- [ ] **Bước 5: Tổng quan** — `AdminDashboardPage.tsx`, mảng `tiles` thêm sau ô "Truyện công khai":

```ts
    {
      title: 'Truyện chờ duyệt',
      value: totals.pendingReviews,
      hint: 'Mở hàng chờ',
      to: paths.adminReviews,
    },
```

- [ ] **Bước 6: Bảng Truyện** — `AdminStoriesPage.tsx`:
  - `const REVIEWS = ['pending', 'rejected'] as const` và `const review = pick(REVIEWS, params.get('review'))`, truyền `review` vào `useAdminStories`.
  - Sau `FilterSelect` "Tiến độ" thêm:

```tsx
          <FilterSelect
            label="Duyệt"
            value={review}
            onChange={(value) => update({ review: value })}
            className="w-36"
            options={[
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'rejected', label: 'Bị từ chối' },
            ]}
          />
```

  - `ClearFilters` keys thêm `'review'`.
  - Cột "Hiển thị": trước nhánh `<Tag>Nháp</Tag>` thêm:

```tsx
                  ) : s.review?.status === 'pending' ? (
                    <Tag color="gold">Chờ duyệt</Tag>
                  ) : s.review?.status === 'rejected' ? (
                    <Tooltip title={`Lý do: ${s.review.reason}`}>
                      <Tag color="volcano">Bị từ chối</Tag>
                    </Tooltip>
```

- [ ] **Bước 7: Dải xem trước** — `src/pages/StoryDetailPage.tsx`, trong `StoryDetail` ngay trước `<StoryHero story={story} />`:

```tsx
      {story.visibility !== 'published' && (
        <div role="status" className="border-b border-border bg-muted/60">
          <Container className="py-2.5 text-sm text-muted-foreground">
            Bản xem trước: truyện chưa công khai, người đọc chưa thấy trang này.
          </Container>
        </div>
      )}
```

- [ ] **Bước 8: Chạy test**

Run: `npx vitest run src/features/admin src/features/stories && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Bước 9: Kiểm tra giao diện** — `npm run dev`, Playwright chụp `/admin/reviews` (cả tab Bị từ chối), `/admin`, `/admin/stories?review=pending`, `/studio/story/<id>` (chờ duyệt, bị từ chối), `/story/<slug>` (dải xem trước) ở 375 / 768 / 1440px, sáng + tối; ảnh để trong `.playwright-mcp/`. Không cuộn ngang trang ở 375px.

- [ ] **Bước 10: Commit** (`Duyệt truyện: trang hàng chờ /admin/reviews, ô Tổng quan, lọc bảng Truyện, dải xem trước`).

---

### Task 5: Database + bản remote

**Files:**
- Create: `supabase/migrations/<timestamp>_story_review.sql` (tạo bằng `supabase migration new story_review`)
- Modify: `supabase/checks/rls_and_rules.sql`
- Modify: `src/types/database.ts` (sinh lại)
- Modify: `src/features/studio/api.remote.ts`, `src/features/admin/api.remote.ts`
- Test: `src/features/studio/api.remote.test.ts`

**Interfaces:**
- Produces (DB): enum `public.review_status`; cột `stories.review_status/review_submitted_at/reviewed_at/review_reason`; RPC `public.submit_story_for_review(p_story_id uuid)`, `public.admin_review_story(p_story_id uuid, p_approve boolean, p_reason text)`; `admin_stories` thêm cột `author_name, genre_slugs, review_status, review_submitted_at, reviewed_at, review_reason`; `admin_overview.totals.pendingReviews`; `studio_stories` thêm 4 cột duyệt.

- [ ] **Bước 1: Viết migration** — nội dung (giữ nguyên thứ tự):

```sql
-- Duyệt truyện trước khi công khai (plan: documents/plan-duyet-truyen.md). Truyện của người không phải
-- quản trị viên chỉ công khai được sau khi quản trị viên duyệt; duyệt một lần là đủ (sau đó tác giả tự
-- ẩn/hiện), bị gỡ thì mất dấu đã duyệt. Tác giả gửi duyệt qua submit_story_for_review, quản trị viên
-- duyệt / từ chối qua admin_review_story. Cột duyệt không cấp quyền ghi cho tác giả.

create type public.review_status as enum ('pending', 'approved', 'rejected');

alter table public.stories
  add column review_status public.review_status,
  add column review_submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column review_reason text check (char_length(review_reason) between 1 and 500),
  -- Lý do chỉ có (và bắt buộc có) khi bị từ chối
  add constraint stories_review_reason_rejected check (
    case when review_status = 'rejected' then review_reason is not null
    else review_reason is null end
  );

-- Truyện đã từng công khai (kể cả đang tự ẩn) và không bị gỡ coi như đã duyệt. Tạm tắt trigger
-- updated_at để thứ tự khu Sáng tác (sửa gần nhất) không đổi.
alter table public.stories disable trigger stories_set_updated_at;
update public.stories
set review_status = 'approved', reviewed_at = published_at
where published_at is not null and taken_down_at is null;
alter table public.stories enable trigger stories_set_updated_at;

-- is_admin chỉ đọc JWT của chính người gọi: cho trigger và policy dưới đây gọi được
grant execute on function private.is_admin() to anon, authenticated;

-- ── Chỉ truyện đã duyệt mới công khai được; quản trị viên công khai là duyệt luôn ──

create function private.stories_require_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'published'
    and (tg_op = 'INSERT' or old.visibility is distinct from 'published')
    and new.review_status is distinct from 'approved' then
    if not private.is_admin() then
      raise exception 'story_not_approved' using errcode = 'P0001';
    end if;
    new.review_status := 'approved';
    new.reviewed_at := now();
    new.review_reason := null;
  end if;
  return new;
end;
$$;

create trigger stories_require_review
  before insert or update of visibility on public.stories
  for each row execute function private.stories_require_review();

-- ── Tác giả gửi duyệt ───────────────────────────────────────────────────

create function private.submit_story_for_review(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story public.stories%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  select * into v_story from public.stories s
  where s.id = p_story_id and s.owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_story.taken_down_at is not null then
    raise exception 'story_taken_down' using errcode = 'P0001';
  end if;
  if v_story.review_status = 'pending' then
    raise exception 'already_pending' using errcode = 'P0001';
  end if;
  if v_story.review_status = 'approved' then
    raise exception 'already_approved' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.chapters c where c.story_id = p_story_id and c.status = 'published'
  ) then
    raise exception 'no_published_chapters' using errcode = 'P0001';
  end if;

  update public.stories
  set review_status = 'pending', review_submitted_at = now(), reviewed_at = null,
    review_reason = null
  where id = p_story_id;
end;
$$;

create function public.submit_story_for_review(p_story_id uuid)
returns void
language sql
set search_path = ''
as $$
  select private.submit_story_for_review(p_story_id)
$$;

-- ── Quản trị viên duyệt / từ chối ───────────────────────────────────────

create function private.admin_review_story(p_story_id uuid, p_approve boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status public.review_status;
begin
  perform private.require_admin();
  select s.review_status into v_status from public.stories s where s.id = p_story_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_status is distinct from 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  if p_approve then
    -- stories_check_publish đặt published_at; truyện chờ duyệt luôn còn chương đã xuất bản
    update public.stories
    set review_status = 'approved', reviewed_at = now(), review_reason = null,
      visibility = 'published'
    where id = p_story_id;
  else
    if v_reason is null then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    update public.stories
    set review_status = 'rejected', reviewed_at = now(), review_reason = left(v_reason, 500)
    where id = p_story_id;
  end if;
end;
$$;

create function public.admin_review_story(p_story_id uuid, p_approve boolean, p_reason text)
returns void
language sql
set search_path = ''
as $$
  select private.admin_review_story(p_story_id, p_approve, p_reason)
$$;
```

  Tiếp theo trong cùng file (chép nguyên định nghĩa mới nhất rồi sửa đúng chỗ ghi):
  - **`private.admin_set_story_takedown`**: `create or replace`, chép từ `20260929013834_admin_moderation.sql`, thêm vào câu `update … set`:

```sql
    review_status = case when v_reason is null then s.review_status end,
    review_submitted_at = case when v_reason is null then s.review_submitted_at end,
    reviewed_at = case when v_reason is null then s.reviewed_at end,
    review_reason = case when v_reason is null then s.review_reason end
```

  - **`private.chapters_before_change`**: `create or replace`, chép từ `20260928035804_catalog.sql`, điều kiện `exists` đổi thành `s.id = old.story_id and (s.visibility = 'published' or s.review_status = 'pending')`, sửa chú thích "Truyện đang công khai hoặc đang chờ duyệt…".
  - **`public.create_story`**: `create or replace` (cùng chữ ký 8 tham số, giữ quyền), chép từ `20260929020147_story_author_name.sql`, thay khối `if p_publish then … end if;`:

```sql
    if p_publish then
      if private.is_admin() then
        update public.stories set visibility = 'published' where id = v_id;
      else
        -- Tác giả: chương đầu đã xuất bản, truyện vào hàng chờ duyệt
        perform private.submit_story_for_review(v_id);
      end if;
    end if;
```

  và sửa chú thích đầu hàm ("p_publish = true thì xuất bản chương đó; tác giả thì gửi duyệt, quản trị viên thì công khai luôn").
  - **`public.studio_stories`**: `create or replace view`, chép từ `20260929020147_story_author_name.sql`, thêm cuối danh sách cột (sau `s.author_name`): `s.review_status, s.review_submitted_at, s.reviewed_at, s.review_reason`.
  - **RLS:**

```sql
-- Quản trị viên đọc được truyện đang chờ duyệt và chương đã xuất bản của nó (xem trước khi duyệt)
alter policy stories_select_visible on public.stories
  using (
    visibility = 'published'
    or owner_id = (select auth.uid())
    or (review_status = 'pending' and (select private.is_admin()))
  );

alter policy chapters_select_visible on public.chapters
  using (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id
      and (
        (s.visibility = 'published' and chapters.status = 'published')
        or s.owner_id = (select auth.uid())
        or (s.review_status = 'pending' and chapters.status = 'published'
          and (select private.is_admin()))
      )
  ));
```

  - **`admin_stories`**: `drop function public.admin_stories(text, public.publication_status, uuid, text); drop function private.admin_stories(text, public.publication_status, uuid, text);` rồi tạo lại cả hai theo `20260929013834_admin_moderation.sql`, kiểu trả về thêm cuối `author_name text, genre_slugs text[], review_status public.review_status, review_submitted_at timestamptz, reviewed_at timestamptz, review_reason text`; phần `select` thêm tương ứng:

```sql
    s.author_name,
    coalesce((
      select array_agg(sg.genre_slug order by sg.position, sg.genre_slug)
      from public.story_genres sg where sg.story_id = s.id
    ), '{}'::text[]),
    s.review_status,
    s.review_submitted_at,
    s.reviewed_at,
    s.review_reason
```

  - **`private.admin_overview`**: `create or replace`, chép từ `20260930080330_comment_replies_and_reports.sql` (bản mới nhất), thêm vào `totals`:

```sql
      'pendingReviews',
        (select count(*) from public.stories s where s.review_status = 'pending'),
```

  - **Quyền:**

```sql
revoke execute on function
  private.stories_require_review(),
  private.submit_story_for_review(uuid),
  private.admin_review_story(uuid, boolean, text),
  private.admin_stories(text, public.publication_status, uuid, text),
  public.submit_story_for_review(uuid),
  public.admin_review_story(uuid, boolean, text),
  public.admin_stories(text, public.publication_status, uuid, text)
from public, anon, authenticated;

grant execute on function
  private.submit_story_for_review(uuid),
  private.admin_review_story(uuid, boolean, text),
  private.admin_stories(text, public.publication_status, uuid, text),
  public.submit_story_for_review(uuid),
  public.admin_review_story(uuid, boolean, text),
  public.admin_stories(text, public.publication_status, uuid, text)
to authenticated;
```

- [ ] **Bước 2: Ca kiểm tra SQL** — `supabase/checks/rls_and_rules.sql`:
  - Sau các hàm `pg_temp.*` ở đầu file thêm hàm duyệt nhanh (chạy bằng quyền chủ file, như quản trị viên duyệt):

```sql
-- Quản trị viên duyệt truyện chờ duyệt (dùng ở các đoạn cần truyện công khai của tác giả thường)
create function pg_temp.approve(p_slug text)
returns void
language sql
security definer
as $$
  update public.stories
  set review_status = 'approved', reviewed_at = now(), review_reason = null,
    visibility = 'published'
  where slug = p_slug
$$;
```

  - Đoạn tác giả A tạo "Trường An Không Tuyết" với `true`: kiểm tra mới thay cho kiểm tra "create_story đăng luôn thì truyện công khai":

```sql
select pg_temp.expect(
  (select visibility = 'draft' and review_status = 'pending' and review_submitted_at is not null
    from public.stories where slug = 'truong-an-khong-tuyet'),
  'create_story đăng luôn (tác giả thường): chương đầu xuất bản, truyện chờ duyệt');
select pg_temp.expect_error(
  $$update public.stories set visibility = 'published' where slug = 'truong-an-khong-tuyet'$$,
  'story_not_approved');
select pg_temp.expect_error(
  $$update public.stories set review_status = 'approved' where slug = 'truong-an-khong-tuyet'$$,
  '42501');
select pg_temp.expect_error(
  $$select public.submit_story_for_review(pg_temp.story_id('truong-an-khong-tuyet'))$$,
  'already_pending');
select pg_temp.expect_error(
  $$update public.chapters set status = 'draft'
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 1$$,
  'last_published_chapter');
select pg_temp.approve('truong-an-khong-tuyet');
select pg_temp.expect(
  (select visibility = 'published' and published_at is not null from public.stories
    where slug = 'truong-an-khong-tuyet'),
  'duyệt xong thì truyện công khai');
```

  - Mọi chỗ khác tác giả thường đăng truyện bằng `create_story(…, true)` (dòng ~284 của B, ~380, ~475) hoặc `update … set visibility = 'published'` thì thêm ngay sau đó `select pg_temp.approve('<slug>');` (với `update visibility` thì thay bằng `pg_temp.approve`). Chạy file để tìm chỗ còn sót (lỗi `FAIL` cho biết dòng).
  - Thêm khối mới sau đoạn "Admin: gỡ truyện, khóa tài khoản":

```sql
-- ── Duyệt truyện ────────────────────────────────────────────────────────

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;
select * from public.create_story('Truyện Chờ Duyệt', 'Giới thiệu.', 'ongoing', array['co-dai'],
  null, '{"title": "Một", "content": "Nội dung."}', true);
select pg_temp.expect_error(
  $$select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), true, null)$$,
  'forbidden');

-- Người khác và khách không thấy truyện chờ duyệt
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect(
  not exists (select 1 from public.stories where slug = 'truyen-cho-duyet'),
  'người khác không thấy truyện chờ duyệt');
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select pg_temp.expect(
  not exists (select 1 from public.stories where slug = 'truyen-cho-duyet'),
  'khách không thấy truyện chờ duyệt');

-- Quản trị viên xem trước (truyện + chương đã xuất bản), từ chối cần lý do, rồi từ chối
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select pg_temp.expect(
  exists (select 1 from public.story_cards where slug = 'truyen-cho-duyet'),
  'quản trị viên thấy truyện chờ duyệt');
select pg_temp.expect(
  exists (select 1 from public.chapters where story_id = pg_temp.story_id('truyen-cho-duyet')
    and number = 1),
  'quản trị viên đọc được chương của truyện chờ duyệt');
select pg_temp.expect(
  (select count(*) = 1 from public.admin_stories() where review_status = 'pending'
    and id not in (select id from existing_stories)),
  'admin_stories có truyện chờ duyệt');
select pg_temp.expect(
  (public.admin_overview(7) -> 'totals' ->> 'pendingReviews')::integer >= 1,
  'admin_overview đếm truyện chờ duyệt');
select pg_temp.expect_error(
  $$select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), false, '  ')$$,
  'reason_required');
select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), false, 'Thiếu giới thiệu');
select pg_temp.expect_error(
  $$select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), true, null)$$,
  'not_pending');

-- B gửi lại, quản trị viên duyệt: công khai; gỡ thì mất dấu đã duyệt
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect(
  (select review_status = 'rejected' and review_reason = 'Thiếu giới thiệu'
    from public.studio_stories where slug = 'truyen-cho-duyet'),
  'tác giả thấy lý do từ chối');
select public.submit_story_for_review(pg_temp.story_id('truyen-cho-duyet'));
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), true, null);
select pg_temp.expect(
  (select visibility = 'published' and review_status = 'approved' and published_at is not null
    from public.stories where slug = 'truyen-cho-duyet'),
  'duyệt thì công khai luôn');
select public.admin_set_story_takedown(pg_temp.story_id('truyen-cho-duyet'), 'Đạo văn');
select public.admin_set_story_takedown(pg_temp.story_id('truyen-cho-duyet'), '');
select pg_temp.expect(
  (select review_status is null from public.stories where slug = 'truyen-cho-duyet'),
  'gỡ rồi khôi phục: phải gửi duyệt lại');
reset role;
```


- [ ] **Bước 3: Thử migration chưa push** (rollback cuối file kiểm tra hủy luôn migration):

```bash
{ echo 'begin;'; cat supabase/migrations/*_story_review.sql; sed '1,/^begin;$/d' supabase/checks/rls_and_rules.sql; } > "$TMPDIR/try_story_review.sql"
supabase db query --linked -f "$TMPDIR/try_story_review.sql"
```

  Expected: không lỗi. Có `FAIL` thì sửa migration / file kiểm tra rồi chạy lại.

- [ ] **Bước 4: Hỏi người dùng rồi push** — giải thích: push xong thì bản production hiện tại (frontend cũ) báo lỗi chung khi tác giả bấm "Xuất bản truyện" cho tới khi gộp `main`. Được đồng ý thì:

```bash
supabase db push --dry-run
supabase db push
supabase db advisors --linked          # không còn WARN
supabase db query --linked -f supabase/checks/rls_and_rules.sql
supabase gen types typescript --linked --schema public > src/types/database.ts
```

- [ ] **Bước 5: Test remote hỏng** — `src/features/studio/api.remote.test.ts`, thêm:

```ts
test('gửi duyệt: gọi RPC rồi đọc lại truyện; trạng thái duyệt và mã lỗi mới', async () => {
  fake.responses = [
    ok(null),
    ok(studioRow({ review_status: 'pending', review_submitted_at: TIME })),
  ]
  const story = await api.submitStoryForReview(STORY_ID)
  expect(fake.queries.at(-2)![0]).toEqual([
    'rpc',
    'submit_story_for_review',
    { p_story_id: STORY_ID },
  ])
  expect(story.review).toEqual({ status: 'pending', submittedAt: TIME, reviewedAt: null, reason: null })

  fake.responses = [business('already_pending')]
  await expect(api.submitStoryForReview(STORY_ID)).rejects.toMatchObject({
    name: 'StudioError',
    code: 'already_pending',
  })
  fake.responses = [business('story_not_approved')]
  await expect(api.publishStory(STORY_ID)).rejects.toMatchObject({ code: 'story_not_approved' })
  await expect(api.submitStoryForReview('khong-phai-uuid')).rejects.toMatchObject({
    code: 'not_found',
  })
})
```

  `studioRow` thêm mặc định `review_status: null, review_submitted_at: null, reviewed_at: null, review_reason: null`.

Run: `npx vitest run src/features/studio/api.remote.test.ts` → FAIL (hàm còn ném "chưa nối Supabase").

- [ ] **Bước 6: Bản remote** — `src/features/studio/api.remote.ts`:

```ts
// trong toMyStory, thay review: null
    review: row.review_status
      ? {
          status: row.review_status,
          submittedAt: row.review_submitted_at,
          reviewedAt: row.reviewed_at,
          reason: row.review_reason,
        }
      : null,
```

```ts
/** Gửi duyệt: RPC kiểm tra chủ truyện, chương đã xuất bản, đang chờ / đã duyệt, bị gỡ */
export async function submitStoryForReview(id: string): Promise<MyStory> {
  await requireUserFor(id)
  unwrap(await db().rpc('submit_story_for_review', { p_story_id: id }), studioError)
  return orNotFound(await findMyStory(id))
}
```

  `src/features/admin/api.remote.ts`:
  - `storySortColumns` thêm `submitted: 'review_submitted_at',`.
  - `getAdminStories` nhận `review`, thêm `if (review) query = query.eq('review_status', review)`; map thay phần tạm:

```ts
      review: r.review_status
        ? {
            status: r.review_status,
            submittedAt: r.review_submitted_at,
            reviewedAt: r.reviewed_at,
            reason: r.review_reason,
          }
        : null,
      authorName: r.author_name,
      genreSlugs: r.genre_slugs ?? [],
```

  - `reviewStory`:

```ts
export async function reviewStory({ storyId, approve, reason }: ReviewInput) {
  await requireUserId()
  if (!isUuid(storyId)) throw new AdminError('not_found')
  unwrap(
    await db().rpc('admin_review_story', {
      p_story_id: storyId,
      p_approve: approve,
      // Kiểu sinh ra đòi string; RPC coi chuỗi rỗng là không có lý do
      p_reason: reason?.trim() ?? '',
    }),
    adminError,
  )
}
```

  - Sửa chú thích đầu file `api.remote.ts` của studio (luật duyệt do trigger `stories_require_review` / RPC giữ).

- [ ] **Bước 7: Chạy test**

Run: `npx vitest run src/features/studio src/features/admin && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Bước 8: Commit** (`Duyệt truyện: migration story_review, ca kiểm tra SQL, nối Supabase`).

---

### Task 6: Tài liệu, kiểm tra cuối, gộp nhánh

**Files:**
- Modify: `documents/thiet-ke-database.md`, `CLAUDE.md`, `documents/plan-bo-cuc-va-cong-nghe.md`, `documents/plan-sang-tac-va-the-loai.md`, `documents/plan-duyet-truyen.md`

- [ ] **Bước 1: `thiet-ke-database.md`**
  - Mục 3: cột `stories` thêm `review_status`, `review_submitted_at`, `reviewed_at`, `review_reason` (≤500, chỉ khi `rejected`); enum `review_status`.
  - Mục 4: thêm dòng `story_not_approved`, `already_pending`, `already_approved` (→ `StudioError`), `not_pending`, `reason_required` (→ `AdminError`); `last_published_chapter` ghi thêm "hoặc đang chờ duyệt".
  - Mục 5: hàng `stories`: "truyện công khai, truyện nháp của chính mình, quản trị viên thấy thêm truyện chờ duyệt"; `chapters` tương tự; ghi `private.is_admin()` được EXECUTE bởi `anon`/`authenticated`.
  - Mục 6: RPC `submit_story_for_review`, `admin_review_story`; `create_story` (tác giả thì gửi duyệt); `admin_stories` thêm cột; `admin_overview` thêm `pendingReviews`.
  - Mục 8: `studio.submitStoryForReview` → `rpc('submit_story_for_review')`; `admin.reviewStory` → `rpc('admin_review_story')`; `getAdminStories` lọc `review_status`.
- [ ] **Bước 2: `CLAUDE.md`** — mục **Sáng tác**: "Truyện của tác giả phải được quản trị viên duyệt mới công khai (`review`: chưa gửi / `pending` / `rejected` / `approved`; `submitStoryForReview`); duyệt một lần là đủ, bị gỡ thì mất dấu đã duyệt; quản trị viên miễn duyệt. Plan: `documents/plan-duyet-truyen.md`." Mục **Quản trị**: thêm "duyệt truyện" vào danh sách trang (`/admin/reviews`, dùng `getAdminStories({ review })` + `reviewStory`). Mục test: helper `draftStory`, `pendingStory`, `approveAsAdmin`; `publishStory` tự duyệt khi người đăng không phải quản trị viên.
- [ ] **Bước 3:** `plan-bo-cuc-va-cong-nghe.md` lộ trình thêm `5h. **Duyệt truyện** ✅ (<ngày>, chi tiết ở plan-duyet-truyen.md)`; `plan-sang-tac-va-the-loai.md` dòng "Duyệt: không cần admin" thêm "(đã đổi 01/10/2026: cần quản trị viên duyệt, xem `plan-duyet-truyen.md`)"; `plan-duyet-truyen.md` đổi trạng thái thành `✅ xong (<ngày>)` và ghi phần "Khác với plan" nếu có.
- [ ] **Bước 4: Kiểm tra toàn bộ**

```bash
npm test && npm run typecheck && npm run lint && npm run build && npx prettier --check .
```

  Expected: tất cả qua.
- [ ] **Bước 5: Commit tài liệu**, rồi gộp: `git checkout main && git merge --no-ff story-review -m "Gộp nhánh story-review: duyệt truyện trước khi công khai"` (không tăng version). **Hỏi người dùng trước khi `git push`** (push `main` = deploy production).
