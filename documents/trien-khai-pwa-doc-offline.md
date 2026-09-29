# Kế hoạch triển khai: PWA và đọc offline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cài web lên màn hình chính như ứng dụng, và đọc tiếp được khi mạng yếu hoặc mất mạng: tự lưu chương đã mở, tự tải trước 5 chương, nút tải về chủ động, tab "Đã lưu", đồng bộ lịch sử đọc khi có mạng lại.

**Architecture:** Service worker (`vite-plugin-pwa`, Workbox `generateSW`) chỉ lo file tĩnh (HTML/JS/CSS/font, ảnh bìa). Dữ liệu chương nằm trong IndexedDB do code app quản lý (`src/features/offline/store.ts`); `useChapter` đọc qua `readChapter` (có bản lưu thì trả ngay và làm mới ở nền). Mọi query/mutation phải chạy được khi offline đặt `networkMode: 'always'`. Lịch sử đọc ghi lúc mất mạng vào hàng chờ localStorage, gửi lại khi có sự kiện `online`.

**Tech Stack:** React 19, TanStack Query v5, Zustand, `idb` 8, `fake-indexeddb` 6 (test), `vite-plugin-pwa` 1.3 (Vite 8), `@vite-pwa/assets-generator` 1, `sonner` (qua shadcn), Vitest 5 + Testing Library.

**Spec:** [plan-pwa-doc-offline.md](plan-pwa-doc-offline.md) (đọc cùng file này).

## Global Constraints

- Chữ trên giao diện, comment, tài liệu, commit message: tiếng Việt. Tên nhánh, đường dẫn, tham số URL: tiếng Anh (tab mới là `?tab=saved`).
- Mọi URL lấy từ `paths` (`src/lib/routes.ts`); thêm `paths.savedChapters = '/library?tab=saved'`.
- Prettier: không chấm phẩy, nháy đơn, `printWidth` 100. Chạy `npx prettier --write <file>` trước mỗi commit. Lint bằng `npm run lint` (oxlint).
- Component không gọi api/kho trực tiếp khi render: đọc qua hook TanStack Query (`features/offline/hooks.ts`, `features/chapters/hooks.ts`...). Hàm ghi vào kho được gọi trong effect/handler.
- Query và mutation cần chạy khi offline: `networkMode: 'always'` (mặc định TanStack Query dừng khi offline).
- Hằng số: tải trước **5** chương (`PREFETCH_COUNT`), tải về từng đợt **20** chương (`DOWNLOAD_BATCH`), chương không ghim tối đa **300** (`MAX_AUTO_CHAPTERS`), dọn **20%** khi bộ nhớ đầy, ảnh bìa cache tối đa **200 ảnh / 30 ngày**.
- Precache không có chunk khu Quản trị (`src/pages/admin/*`) và Sáng tác (`src/pages/studio/*`); font chỉ bộ `latin`, `latin-ext`, `vietnamese` (bỏ `cyrillic*`, `greek*`, `.woff`).
- Màu nền app/icon: `#1a0f1d` (token `--background` theme tối).
- Test: mock có độ trễ → `findBy*` kèm `{ timeout: 3000 }`; điều hướng trang lazy → `expect.poll`; giả mất mạng bằng `goOffline()` (`src/test/offline.ts`); mỗi test có kho IndexedDB trống (setup).
- Commit message kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Kiểm UI ở 375px, 768px, 1440px, cả hai theme (bước cuối).

## Review Focus

1. **Trình duyệt chặn IndexedDB** (chế độ riêng tư, bị tắt): mọi hàm kho không ném lỗi, app đọc như trước. → test ở Task 2.
2. **Mở app lúc offline khi đã đăng nhập**: không kẹt ở khung chờ (query phiên bị dừng), vẫn nhận đúng tài khoản (bản Supabase không tải được hồ sơ). → test ở Task 5 (bản giả) và Task 6 (bản Supabase).
3. **Đang tải về thì hủy, rồi bấm tải lại**: chỉ tải phần còn thiếu, không tải lại từ đầu. → test ở Task 7.
4. **Hàng chờ lịch sử của tài khoản A khi tài khoản B đăng nhập trên cùng máy**: không gửi hàng chờ của A dưới tên B. → test ở Task 8.
5. **Offline mở trang khu Sáng tác/Quản trị** (chunk không có trong cache): màn hình "Bạn đang offline" thay vì màn hình lỗi mặc định của React Router. → test ở Task 6.

---

## Cấu trúc file

| File | Trách nhiệm |
| --- | --- |
| `src/features/chapters/api*.ts` | Thêm `getChapterRange`, `countChaptersFrom`; `ChapterContent.story.coverUrl` |
| `src/lib/network.ts` | `isNetworkError(error)` |
| `src/hooks/useOnline.ts` | Trạng thái mạng (`useSyncExternalStore`) |
| `src/features/offline/store.ts` | Kho IndexedDB: lưu, đọc, ghim, dọn, liệt kê |
| `src/features/offline/readChapter.ts` | Đọc chương qua kho, làm mới ở nền, `ChapterNotSavedError` |
| `src/features/offline/prefetch.ts` | Tải trước 5 chương (`usePrefetchChapters`) |
| `src/features/offline/downloads.ts` | Tải về chủ động (store Zustand tiến độ) |
| `src/features/offline/hooks.ts` | Hook Query đọc kho (`useSavedStories`, `useSavedChapters`...) |
| `src/features/offline/components/*` | `NotSavedNotice`, `SavedList`, `DownloadButton` |
| `src/features/library/pendingProgress.ts` | Hàng chờ lịch sử đọc lúc mất mạng |
| `src/features/library/components/OfflineSync.tsx` | Gửi hàng chờ khi có mạng |
| `src/components/common/{OfflineBanner,RouteError,InstallAppButton}.tsx` | Giao diện chung |
| `src/hooks/useInstallPrompt.ts` | Sự kiện `beforeinstallprompt` |
| `src/app/PwaUpdater.tsx` | Thông báo có phiên bản mới |
| `pwa.config.ts`, `pwa-assets.config.ts` | Cấu hình PWA, chọn chunk precache, sinh icon |
| `src/test/offline.ts` | `goOffline`, `goOnline`, `fakeChapter` cho test |

---

### Task 1: Api chương — lấy nhiều chương một lần, đếm chương còn lại, ảnh bìa

**Files:**
- Modify: `src/types/chapter.ts:29-38`
- Modify: `src/features/chapters/api.mock.ts`
- Modify: `src/features/chapters/api.remote.ts`
- Modify: `src/features/chapters/api.ts`
- Modify: `src/features/chapters/hooks.ts`
- Test: `src/features/chapters/api.test.ts`, `src/features/chapters/api.remote.test.ts`, `src/features/reader/components/ChapterArticle.test.tsx` (fixture)

**Interfaces:**
- Produces:
  - `ChapterContent['story']` có thêm `coverUrl: string | null`.
  - `getChapterRange(slug: string, from: number, count: number): Promise<ChapterContent[]>` — chương **đã xuất bản** có số ≥ `from`, tăng dần, tối đa `count`; mỗi chương y hệt kết quả `getChapter` (đủ `prev`/`next`). `count <= 0` hoặc không thấy truyện → `[]`.
  - `countChaptersFrom(slug: string, from: number): Promise<number>`.
  - `chapterKeys.countFrom(slug, from)` = `['chapters', slug, 'count-from', from]`, hook `useChapterCountFrom(slug, from)`.

- [ ] **Step 1: Viết test hỏng cho bản giả**

Thêm vào cuối `src/features/chapters/api.test.ts` (sửa dòng import thành `import { countChaptersFrom, getChapter, getChapterList, getChapterRange } from './api'`):

```ts
test('getChapterRange: các chương từ số `from`, giống hệt getChapter; countChaptersFrom đếm phần còn lại', async () => {
  const range = await getChapterRange(story.slug, 10, 3)
  expect(range.map((c) => c.number)).toEqual([10, 11, 12])
  expect(range[1]).toEqual(await getChapter(story.slug, 11))
  expect(range[0].story).toMatchObject({ slug: story.slug, coverUrl: story.coverUrl })
  expect((await getChapterRange(story.slug, 411, 5)).map((c) => c.number)).toEqual([411, 412])
  expect(await getChapterRange(story.slug, 413, 5)).toEqual([])
  expect(await getChapterRange(story.slug, 1, 0)).toEqual([])
  expect(await getChapterRange('khong-co-truyen-nay', 1, 5)).toEqual([])
  expect(await countChaptersFrom(story.slug, 400)).toBe(13)
  expect(await countChaptersFrom('khong-co-truyen-nay', 1)).toBe(0)
})
```

- [ ] **Step 2: Viết test hỏng cho bản Supabase**

Trong `src/features/chapters/api.remote.test.ts`:

1. Sửa import: `import { countChaptersFrom, getChapter, getChapterList, getChapterRange, recordChapterView } from './api.remote'`.
2. Trong `respond()`: thêm biến `let head = false` cạnh `let exactCount = false`; nhánh `case 'select':` thêm dòng `head = (value as { head?: boolean } | undefined)?.head === true`; thêm nhánh:

```ts
      case 'gte':
        rows = rows.filter((r) => (r[column] as number) >= (value as number))
        break
```

   và ngay sau `const total = rows.length` thêm:

```ts
  // select(..., { count: 'exact', head: true }): chỉ đếm, không trả dòng
  if (head) return { data: null, count: exactCount ? total : null, error: null }
```

3. Chuyển hằng `const story: Story = { ... }` từ trong `describe('getChapter', ...)` ra ngoài, đặt ngay trên `describe('getChapter', ...)` (giữ nguyên nội dung).
4. Trong test `'chương trước/sau bỏ qua chương nháp và số bị bỏ trống'`, object `story` mong đợi thêm dòng `coverUrl: null,` sau `chapterCount: 3,`.
5. Thêm cuối file:

```ts
describe('getChapterRange và countChaptersFrom', () => {
  beforeEach(() => {
    fake.story = story
    // Chương 5 là bản nháp, bỏ trống số 3 và 6; truyện B có chương cùng số
    fake.rows = [1, 2, 4, 7, 8].map((n) => chapter('truyen-a', n))
    fake.rows.push(chapter('truyen-a', 5, 'draft'), chapter('truyen-b', 4))
  })

  test('chương từ số `from`, trước/sau theo chương đã xuất bản như getChapter', async () => {
    const range = await getChapterRange('truyen-a', 3, 2)
    expect(range.map((c) => [c.prev?.number ?? null, c.number, c.next?.number ?? null])).toEqual([
      [2, 4, 7],
      [4, 7, 8],
    ])
    expect(range[0]).toEqual(await getChapter('truyen-a', 4))
    expect((await getChapterRange('truyen-a', 8, 5)).map((c) => c.next)).toEqual([null])
  })

  test('không thấy truyện, hết chương hoặc count = 0 thì rỗng', async () => {
    expect(await getChapterRange('khong-co', 1, 5)).toEqual([])
    expect(await getChapterRange('truyen-a', 9, 5)).toEqual([])
    expect(await getChapterRange('truyen-a', 1, 0)).toEqual([])
  })

  test('countChaptersFrom chỉ đếm chương đã xuất bản có số ≥ from', async () => {
    expect(await countChaptersFrom('truyen-a', 3)).toBe(3)
    expect(await countChaptersFrom('truyen-a', 9)).toBe(0)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/features/chapters`
Expected: FAIL — `getChapterRange is not a function` / `countChaptersFrom is not a function`, và test `getChapter` remote hỏng vì thiếu `coverUrl`.

- [ ] **Step 4: Thêm `coverUrl` vào kiểu**

`src/types/chapter.ts`, trong `ChapterContent`:

```ts
export type ChapterContent = {
  story: {
    slug: string
    title: string
    author: Author
    status: StoryStatus
    chapterCount: number
    /** Ảnh bìa (tab "Đã lưu" hiện bìa của truyện đã lưu trên máy) */
    coverUrl: string | null
  }
```

(giữ nguyên các trường còn lại). Trong `src/features/reader/components/ChapterArticle.test.tsx`, object `story` của fixture thêm `coverUrl: null,` sau `chapterCount: 1,`.

- [ ] **Step 5: Bản giả**

Trong `src/features/chapters/api.mock.ts`: thêm `import type { Story } from '@/types/story'`, thay hàm `getChapter` bằng đoạn dưới (giữ `getChapterList` và `recordChapterView`):

```ts
/** Truyện theo slug, theo quyền xem của người đang dùng (chủ truyện thấy cả bản nháp) */
async function readerStory(slug: string) {
  await delay()
  const viewer = await getSession()
  return findStory(slug, viewer?.id ?? null)
}

/** Chương thứ `index` trong mục lục `all`, dạng cho trang đọc */
function toChapterContent(
  story: Story,
  all: ChapterSummary[],
  index: number,
  content: string,
): ChapterContent {
  const neighbor = (c: ChapterSummary | undefined) =>
    c ? { number: c.number, title: c.title } : null
  return {
    story: {
      slug: story.slug,
      title: story.title,
      author: story.author,
      status: story.status,
      chapterCount: all.length,
      coverUrl: story.coverUrl,
    },
    number: all[index].number,
    title: all[index].title,
    content,
    publishedAt: all[index].createdAt,
    prev: neighbor(all[index - 1]),
    next: neighbor(all[index + 1]),
  }
}

/** Một chương để đọc, kèm chương trước/sau; null khi không có truyện hoặc chương */
export async function getChapter(slug: string, number: number): Promise<ChapterContent | null> {
  const story = await readerStory(slug)
  if (!story) return null
  // Chương của truyện người dùng có thể không liền số (chương nháp bị ẩn) nên tìm theo vị trí
  const all = readerChapters(story)
  const index = all.findIndex((c) => c.number === number)
  const content = index === -1 ? null : readerChapterContent(story, number)
  return content === null ? null : toChapterContent(story, all, index, content)
}

/** Tối đa `count` chương đã xuất bản có số ≥ `from`, tăng dần (tải trước, tải về đọc offline) */
export async function getChapterRange(
  slug: string,
  from: number,
  count: number,
): Promise<ChapterContent[]> {
  const story = await readerStory(slug)
  if (!story || count <= 0) return []
  const all = readerChapters(story)
  const start = all.findIndex((c) => c.number >= from)
  if (start === -1) return []
  return all.slice(start, start + count).flatMap((c, i) => {
    const content = readerChapterContent(story, c.number)
    return content === null ? [] : [toChapterContent(story, all, start + i, content)]
  })
}

/** Số chương đã xuất bản có số ≥ `from` */
export async function countChaptersFrom(slug: string, from: number): Promise<number> {
  const story = await readerStory(slug)
  return story ? readerChapters(story).filter((c) => c.number >= from).length : 0
}
```

- [ ] **Step 6: Bản Supabase**

Trong `src/features/chapters/api.remote.ts`: thêm `import type { Story } from '@/types/story'`. Thêm hàm dưới đây ngay trên `getChapter`, và trong `getChapter` thay khối `story: { ... }` bằng `story: readerStory(story),`:

```ts
/** Thông tin truyện đi kèm mỗi chương cho người đọc */
const readerStory = (story: Story): ChapterContent['story'] => ({
  slug: story.slug,
  title: story.title,
  author: story.author,
  status: story.status,
  // Số chương đã xuất bản (story_stats)
  chapterCount: story.chapterCount,
  coverUrl: story.coverUrl,
})
```

Thêm sau `getChapter`:

```ts
/** Chương đã xuất bản có số ≥ `from`, tăng dần, tối đa `limit`: kèm nội dung hoặc chỉ số và tên */
async function chaptersFrom(slug: string, from: number, limit: number) {
  return unwrap(
    await db()
      .from('chapters')
      .select('number, title, content, published_at, created_at, stories!inner(slug)')
      .eq('stories.slug', slug)
      .eq('status', 'published')
      .gte('number', from)
      .order('number', { ascending: true })
      .limit(limit),
  )
}

async function outlineFrom(slug: string, from: number, limit: number) {
  return unwrap(
    await db()
      .from('chapters')
      .select('number, title, stories!inner(slug)')
      .eq('stories.slug', slug)
      .eq('status', 'published')
      .gte('number', from)
      .order('number', { ascending: true })
      .limit(limit),
  )
}

/**
 * Tối đa `count` chương đã xuất bản có số ≥ `from` (tải trước, tải về đọc offline). Nội dung chỉ
 * lấy `count` chương; mục lục lấy thêm 1 chương để biết chương sau của chương cuối.
 */
export async function getChapterRange(
  slug: string,
  from: number,
  count: number,
): Promise<ChapterContent[]> {
  if (count <= 0) return []
  const [story, rows, outline, prev] = await Promise.all([
    storyBySlug(slug),
    chaptersFrom(slug, from, count),
    outlineFrom(slug, from, count + 1),
    neighbor(slug, from, 'prev'),
  ])
  if (!story) return []
  const byNumber = new Map(rows.map((r) => [r.number, r]))
  const toNeighbor = (c: { number: number; title: string } | undefined) =>
    c ? { number: c.number, title: c.title } : null
  return outline.slice(0, count).flatMap((c, i) => {
    const row = byNumber.get(c.number)
    if (!row) return []
    return [
      {
        story: readerStory(story),
        number: row.number,
        title: row.title,
        content: row.content,
        publishedAt: publishedAt(row),
        prev: i === 0 ? prev : toNeighbor(outline[i - 1]),
        next: toNeighbor(outline[i + 1]),
      },
    ]
  })
}

/** Số chương đã xuất bản có số ≥ `from` */
export async function countChaptersFrom(slug: string, from: number): Promise<number> {
  const { count, error } = await db()
    .from('chapters')
    .select('number, stories!inner(slug)', { count: 'exact', head: true })
    .eq('stories.slug', slug)
    .eq('status', 'published')
    .gte('number', from)
  if (error) throw error
  return count ?? 0
}
```

- [ ] **Step 7: Export và hook**

`src/features/chapters/api.ts`: dòng cuối thành

```ts
export const { getChapterList, getChapter, getChapterRange, countChaptersFrom, recordChapterView } =
  api
```

`src/features/chapters/hooks.ts`: thêm vào `chapterKeys`:

```ts
  countFrom: (slug: string, from: number) => ['chapters', slug, 'count-from', from] as const,
```

và thêm hook:

```ts
/** Số chương đã xuất bản từ chương `from` trở đi (hộp thoại tải về đọc offline) */
export const useChapterCountFrom = (slug: string, from: number) =>
  useQuery({
    queryKey: chapterKeys.countFrom(slug, from),
    queryFn: () => api.countChaptersFrom(slug, from),
  })
```

- [ ] **Step 8: Chạy test và typecheck**

Run: `npx vitest run src/features/chapters src/features/reader/components/ChapterArticle.test.tsx && npm run typecheck`
Expected: PASS, typecheck không lỗi (nếu tsc báo thiếu `coverUrl` ở fixture khác, thêm `coverUrl: null` vào đúng object đó).

- [ ] **Step 9: Commit**

```bash
npx prettier --write src/types/chapter.ts src/features/chapters src/features/reader/components/ChapterArticle.test.tsx
git add src/types/chapter.ts src/features/chapters src/features/reader/components/ChapterArticle.test.tsx
git commit -F - <<'EOF'
Chương: lấy nhiều chương một lần, đếm chương còn lại, kèm ảnh bìa

getChapterRange và countChaptersFrom (bản giả + Supabase) cho tải trước và tải về
đọc offline; ChapterContent.story có coverUrl.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Nền tảng offline — lỗi mạng, trạng thái mạng, kho IndexedDB

**Files:**
- Create: `src/lib/network.ts`, `src/lib/network.test.ts`
- Create: `src/hooks/useOnline.ts`, `src/hooks/useOnline.test.ts`
- Create: `src/features/offline/store.ts`, `src/features/offline/store.test.ts`
- Create: `src/test/offline.ts`
- Modify: `src/test/setup.ts`, `package.json` (qua npm)

**Interfaces:**
- Consumes: `ChapterContent` (có `coverUrl`) từ Task 1.
- Produces:
  - `isNetworkError(error: unknown): boolean`
  - `useOnline(): boolean`
  - `store.ts`: `MAX_AUTO_CHAPTERS = 300`; `type SavedStory = { story: ChapterContent['story']; numbers: number[]; pinned: boolean; bytes: number; resume: { number: number; progress: number }; usedAt: string }`; `class OfflineStorageFullError`; `getSavedChapter(slug, number): Promise<ChapterContent | null>`; `saveChapters(chapters: ChapterContent[], options?: { pinned?: boolean }): Promise<void>`; `markRead(slug, number, progress?: number): Promise<void>`; `pinChapters(slug, numbers: number[]): Promise<void>`; `walkSaved(slug, from, limit): Promise<{ saved: number[]; missing: number | null }>`; `listSavedStories(): Promise<SavedStory[]>`; `savedChapterList(slug): Promise<ChapterNeighbor[]>`; `removeSavedChapter(slug, number)`; `removeSavedStory(slug)`; `clearSaved()`; `resetOfflineDatabase()` (chỉ test).
  - `src/test/offline.ts`: `goOffline()`, `goOnline()`, `fakeChapter(slug, number, options?: { title?: string; last?: number }): ChapterContent`.

- [ ] **Step 1: Cài thư viện**

Run: `npm install idb@^8 && npm install -D fake-indexeddb@^6`
Expected: `package.json` có `idb` trong `dependencies`, `fake-indexeddb` trong `devDependencies`.

- [ ] **Step 2: Tiện ích test**

Tạo `src/test/offline.ts`:

```ts
// Tiện ích cho test đọc offline: giả mất mạng, tạo chương giả để lưu thẳng vào kho trên máy
import { act } from '@testing-library/react'
import type { MockInstance } from 'vitest'
import type { ChapterContent } from '@/types/chapter'

let offline: MockInstance | undefined

/** Giả mất mạng: navigator.onLine = false và phát sự kiện offline (TanStack Query, useOnline nghe) */
export function goOffline() {
  offline ??= vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
}

/** Có mạng lại; setup.ts gọi sau mỗi test để onlineManager của TanStack Query không kẹt offline */
export function goOnline() {
  offline?.mockRestore()
  offline = undefined
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
}

/** Chương giả (chương sau là number + 1, tới chương `last`) */
export function fakeChapter(
  slug: string,
  number: number,
  { title = 'Mùa Hạ', last = 1000 }: { title?: string; last?: number } = {},
): ChapterContent {
  return {
    story: {
      slug,
      title,
      author: { slug: 'tac-gia-u1', name: 'Tác giả' },
      status: 'ongoing',
      chapterCount: last,
      coverUrl: null,
    },
    number,
    title: `Chương ${number}`,
    content: `<p>Nội dung chương ${number}.</p>`,
    publishedAt: '2026-09-01T00:00:00.000Z',
    prev: number > 1 ? { number: number - 1, title: `Chương ${number - 1}` } : null,
    next: number < last ? { number: number + 1, title: `Chương ${number + 1}` } : null,
  }
}
```

- [ ] **Step 3: Viết test hỏng**

`src/lib/network.test.ts`:

```ts
import { goOffline } from '@/test/offline'
import { isNetworkError } from './network'

test('lỗi fetch của trình duyệt và lỗi supabase-js trả về khi mất mạng là lỗi mạng', () => {
  expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  expect(isNetworkError(new TypeError('Load failed'))).toBe(true)
  expect(
    isNetworkError({ message: 'TypeError: NetworkError when attempting to fetch resource.', code: '' }),
  ).toBe(true)
})

test('lỗi máy chủ và lỗi trong code không phải lỗi mạng', () => {
  expect(
    isNetworkError({ code: '57014', message: 'canceling statement due to statement timeout' }),
  ).toBe(false)
  expect(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
    false,
  )
  expect(isNetworkError(null)).toBe(false)
})

test('máy báo offline thì lỗi nào cũng coi là lỗi mạng', () => {
  goOffline()
  expect(isNetworkError(new Error('bất kỳ'))).toBe(true)
})
```

`src/hooks/useOnline.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { goOffline, goOnline } from '@/test/offline'
import { useOnline } from './useOnline'

test('theo sự kiện online/offline của trình duyệt', () => {
  const { result } = renderHook(() => useOnline())
  expect(result.current).toBe(true)
  goOffline()
  expect(result.current).toBe(false)
  goOnline()
  expect(result.current).toBe(true)
})
```

`src/features/offline/store.test.ts`:

```ts
import { fakeChapter } from '@/test/offline'
import {
  clearSaved,
  getSavedChapter,
  listSavedStories,
  markRead,
  MAX_AUTO_CHAPTERS,
  OfflineStorageFullError,
  pinChapters,
  removeSavedChapter,
  removeSavedStory,
  resetOfflineDatabase,
  saveChapters,
  savedChapterList,
  walkSaved,
} from './store'

const range = (slug: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => fakeChapter(slug, from + i))

/** Giả giờ hệ thống (chỉ Date: fake-indexeddb cần setImmediate thật) */
const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('lưu rồi đọc lại đủ nội dung; chương chưa lưu là null', async () => {
  const chapter = fakeChapter('mua-ha', 3)
  await saveChapters([chapter])
  expect(await getSavedChapter('mua-ha', 3)).toEqual(chapter)
  expect(await getSavedChapter('mua-ha', 4)).toBeNull()
  expect(await savedChapterList('mua-ha')).toEqual([{ number: 3, title: 'Chương 3' }])
})

test('lưu lại (làm mới) giữ chỗ đã đọc và cờ ghim', async () => {
  await saveChapters([fakeChapter('mua-ha', 1)], { pinned: true })
  await markRead('mua-ha', 1, 0.5)
  await saveChapters([{ ...fakeChapter('mua-ha', 1), content: '<p>Bản sửa.</p>' }])
  expect(await getSavedChapter('mua-ha', 1)).toMatchObject({ content: '<p>Bản sửa.</p>' })
  expect(await listSavedStories()).toMatchObject([
    { pinned: true, numbers: [1], resume: { number: 1, progress: 0.5 } },
  ])
})

test(`quá ${MAX_AUTO_CHAPTERS} chương tự lưu: xóa chương lâu không dùng nhất, giữ chương ghim và truyện vừa lưu`, async () => {
  at('2026-09-01T00:00:00Z')
  await saveChapters(range('cu', 1, 5))
  at('2026-09-02T00:00:00Z')
  await saveChapters(range('ghim', 1, 3), { pinned: true })
  await saveChapters(range('doc-lai', 1, 2))
  at('2026-09-03T00:00:00Z')
  await markRead('cu', 5) // vừa đọc lại: chưa bị xóa
  at('2026-09-04T00:00:00Z')
  await saveChapters(range('moi', 1, MAX_AUTO_CHAPTERS - 2))

  // Không ghim: cu 5 + doc-lai 2 + moi 298 = 305 → xóa 5 chương dùng lâu nhất ngoài truyện "moi"
  expect((await savedChapterList('cu')).map((c) => c.number)).toEqual([5])
  expect((await savedChapterList('doc-lai')).map((c) => c.number)).toEqual([2])
  expect(await savedChapterList('ghim')).toHaveLength(3)
  expect(await savedChapterList('moi')).toHaveLength(MAX_AUTO_CHAPTERS - 2)
})

test('walkSaved lần theo chương sau của bản lưu, dừng ở chương còn thiếu', async () => {
  await saveChapters([...range('mua-ha', 5, 7), fakeChapter('mua-ha', 10, { last: 10 })])
  expect(await walkSaved('mua-ha', 5, 5)).toEqual({ saved: [5, 6, 7], missing: 8 })
  expect(await walkSaved('mua-ha', 5, 2)).toEqual({ saved: [5, 6], missing: null })
  expect(await walkSaved('mua-ha', 10, 5)).toEqual({ saved: [10], missing: null }) // chương cuối
  expect(await walkSaved('mua-ha', 1, 5)).toEqual({ saved: [], missing: 1 })
})

test('ghim, xóa một chương, xóa một truyện, xóa tất cả', async () => {
  await saveChapters([...range('a', 1, 3), ...range('b', 1, 2)])
  await pinChapters('a', [2])
  expect((await listSavedStories()).find((s) => s.story.slug === 'a')?.pinned).toBe(true)
  await removeSavedChapter('a', 1)
  expect((await savedChapterList('a')).map((c) => c.number)).toEqual([2, 3])
  await removeSavedStory('a')
  expect(await getSavedChapter('a', 2)).toBeNull()
  expect((await listSavedStories()).map((s) => s.story.slug)).toEqual(['b'])
  await clearSaved()
  expect(await listSavedStories()).toEqual([])
})

test('danh sách truyện: dùng gần nhất trước; "Đọc tiếp" là chương đọc gần nhất, chưa đọc thì chương đầu', async () => {
  at('2026-09-01T00:00:00Z')
  await saveChapters(range('a', 3, 5))
  at('2026-09-02T00:00:00Z')
  await saveChapters(range('b', 1, 2))
  at('2026-09-03T00:00:00Z')
  await markRead('a', 4, 0.3)
  const stories = await listSavedStories()
  expect(stories.map((s) => s.story.slug)).toEqual(['a', 'b'])
  expect(stories[0]).toMatchObject({
    numbers: [3, 4, 5],
    pinned: false,
    resume: { number: 4, progress: 0.3 },
  })
  expect(stories[0].bytes).toBeGreaterThan(0)
  expect(stories[1].resume).toEqual({ number: 1, progress: 0 })
})

test('bộ nhớ đầy: dọn 20% chương cũ rồi lưu lại; vẫn đầy thì báo OfflineStorageFullError', async () => {
  await saveChapters(range('cu', 1, 10))
  const full = () => {
    throw new DOMException('Hết chỗ', 'QuotaExceededError')
  }
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(full)
  await saveChapters([fakeChapter('moi', 1)])
  expect(await getSavedChapter('moi', 1)).not.toBeNull()
  expect(await savedChapterList('cu')).toHaveLength(8)

  put.mockImplementation(full)
  await expect(saveChapters([fakeChapter('moi', 2)])).rejects.toBeInstanceOf(
    OfflineStorageFullError,
  )
})

test('trình duyệt không cho dùng IndexedDB: kho coi như trống, không báo lỗi', async () => {
  await resetOfflineDatabase()
  vi.stubGlobal('indexedDB', undefined)
  await expect(saveChapters([fakeChapter('mua-ha', 1)])).resolves.toBeUndefined()
  expect(await getSavedChapter('mua-ha', 1)).toBeNull()
  expect(await listSavedStories()).toEqual([])
  expect(await walkSaved('mua-ha', 1, 5)).toEqual({ saved: [], missing: 1 })
  await resetOfflineDatabase()
  vi.unstubAllGlobals()
})
```

- [ ] **Step 4: Nạp fake-indexeddb trong setup**

`src/test/setup.ts`: thêm ngay dưới dòng import đầu tiên:

```ts
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { resetOfflineDatabase } from '@/features/offline/store'
import { goOnline } from './offline'
```

và thêm cuối file:

```ts
// Kho chương đọc offline (IndexedDB): mỗi test một kho trống; hết test thì có mạng lại
beforeEach(async () => {
  await resetOfflineDatabase()
  vi.stubGlobal('indexedDB', new IDBFactory())
})
afterEach(() => goOnline())
```

- [ ] **Step 5: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/lib/network.test.ts src/hooks/useOnline.test.ts src/features/offline/store.test.ts`
Expected: FAIL — không tìm thấy module `./network`, `./useOnline`, `./store`.

- [ ] **Step 6: `src/lib/network.ts`**

```ts
// Nhận biết lỗi do mất mạng / mạng chập chờn (khác lỗi máy chủ trả về), để phần đọc offline dùng
// bản lưu trên máy thay vì báo lỗi.

/** Thông báo lỗi fetch của Chrome, Firefox, Safari và Node (undici) */
const FETCH_FAILED = /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed/i

/**
 * Lỗi mạng: máy đang offline, hoặc fetch không tới được máy chủ. supabase-js không ném lỗi fetch
 * mà trả `{ message: 'TypeError: Failed to fetch', code: '' }`, nên kiểm theo message.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && FETCH_FAILED.test(message)
}
```

- [ ] **Step 7: `src/hooks/useOnline.ts`**

```ts
import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Máy có đang nối mạng không (navigator.onLine, cập nhật theo sự kiện online/offline) */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
```

- [ ] **Step 8: `src/features/offline/store.ts`**

```ts
// Kho chương trên máy (IndexedDB) cho đọc offline: chương đã mở, chương tải trước và chương người
// đọc tự tải về (ghim, không tự xóa). Nội dung chương nằm ở store riêng (`contents`) để liệt kê và
// dọn kho chỉ đọc phần thông tin nhỏ. Kho dùng chung cho cả máy vì nội dung chương là công khai.
// Trình duyệt không cho dùng IndexedDB (chế độ riêng tư, bị chặn) thì kho coi như trống.
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { ChapterContent, ChapterNeighbor } from '@/types/chapter'

/** Chương không ghim giữ tối đa bấy nhiêu; vượt thì xóa chương lâu không dùng nhất */
export const MAX_AUTO_CHAPTERS = 300

type ChapterRecord = {
  /** `${slug}#${number}` */
  id: string
  slug: string
  number: number
  meta: Omit<ChapterContent, 'content'>
  /** 1: người đọc tải về (không tự xóa). Dạng số vì IndexedDB không đánh chỉ mục boolean */
  pinned: 0 | 1
  /** Dung lượng nội dung (UTF-8) */
  bytes: number
  savedAt: string
  readAt: string | null
  /** Mốc xóa chương lâu không dùng: lần đọc cuối, chưa đọc thì lần lưu */
  usedAt: string
  progress: number | null
}

interface OfflineDB extends DBSchema {
  chapters: {
    key: string
    value: ChapterRecord
    indexes: { bySlug: string; byUse: [number, string] }
  }
  contents: { key: string; value: string }
}

/** Truyện có chương trong kho (tab "Đã lưu") */
export type SavedStory = {
  story: ChapterContent['story']
  /** Số các chương đã lưu, tăng dần */
  numbers: number[]
  /** Có chương người đọc tự tải về */
  pinned: boolean
  bytes: number
  /** Chương để "Đọc tiếp": đọc gần nhất, chưa đọc chương nào thì chương nhỏ nhất */
  resume: { number: number; progress: number }
  usedAt: string
}

export class OfflineStorageFullError extends Error {
  constructor() {
    super('Bộ nhớ máy đã đầy.')
    this.name = 'OfflineStorageFullError'
  }
}

const idOf = (slug: string, number: number) => `${slug}#${number}`
const encoder = new TextEncoder()
const isQuotaError = (error: unknown) =>
  (error as { name?: unknown } | null)?.name === 'QuotaExceededError'

let dbPromise: Promise<IDBPDatabase<OfflineDB> | null> | undefined

function database() {
  dbPromise ??=
    typeof indexedDB === 'undefined'
      ? Promise.resolve(null)
      : openDB<OfflineDB>('offline-reading', 1, {
          upgrade(db) {
            const chapters = db.createObjectStore('chapters', { keyPath: 'id' })
            chapters.createIndex('bySlug', 'slug')
            chapters.createIndex('byUse', ['pinned', 'usedAt'])
            db.createObjectStore('contents')
          },
        }).catch(() => null)
  return dbPromise
}

/** Chỉ dùng trong test: đóng kết nối để test sau mở kho mới */
export async function resetOfflineDatabase() {
  const db = await dbPromise
  db?.close()
  dbPromise = undefined
}

let persistAsked = false

/** Xin trình duyệt giữ kho lâu dài (Safari tự xóa dữ liệu của trang không dùng sau 7 ngày) */
async function requestPersistence() {
  if (persistAsked) return
  persistAsked = true
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Trình duyệt không hỗ trợ: dữ liệu vẫn lưu, chỉ có thể bị dọn khi máy thiếu chỗ
  }
}

/** Chương đã lưu, đủ nội dung; null nếu chưa có */
export async function getSavedChapter(slug: string, number: number) {
  const db = await database()
  if (!db) return null
  const tx = db.transaction(['chapters', 'contents'])
  const id = idOf(slug, number)
  const [record, content] = await Promise.all([
    tx.objectStore('chapters').get(id),
    tx.objectStore('contents').get(id),
  ])
  return record && content !== undefined ? ({ ...record.meta, content } as ChapterContent) : null
}

async function put(db: IDBPDatabase<OfflineDB>, chapters: ChapterContent[], pinned: boolean) {
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  const store = tx.objectStore('chapters')
  const now = new Date().toISOString()
  await Promise.all([
    ...chapters.map(async ({ content, ...meta }) => {
      const id = idOf(meta.story.slug, meta.number)
      const old = await store.get(id)
      await store.put({
        id,
        slug: meta.story.slug,
        number: meta.number,
        meta,
        pinned: pinned || old?.pinned === 1 ? 1 : 0,
        bytes: encoder.encode(content).length,
        savedAt: now,
        readAt: old?.readAt ?? null,
        usedAt: old?.readAt ?? now,
        progress: old?.progress ?? null,
      })
      await tx.objectStore('contents').put(content, id)
    }),
    tx.done,
  ])
}

/**
 * Xóa chương không ghim dùng lâu nhất tới khi còn MAX_AUTO_CHAPTERS; `fraction` > 0 thì xóa thêm
 * chừng ấy phần số chương không ghim (lấy chỗ khi bộ nhớ đầy). Không đụng truyện `keep`.
 */
async function evict(db: IDBPDatabase<OfflineDB>, keep: string, fraction = 0) {
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  const index = tx.objectStore('chapters').index('byUse')
  const unpinned = IDBKeyRange.bound([0, ''], [0, '￿'])
  const total = await index.count(unpinned)
  let excess = Math.max(total - MAX_AUTO_CHAPTERS, 0) + Math.ceil(total * fraction)
  // Chỉ đọc khóa (không nạp nội dung), dùng lâu nhất trước
  let cursor = excess > 0 ? await index.openKeyCursor(unpinned) : null
  while (cursor && excess > 0) {
    const id = cursor.primaryKey
    if (!id.startsWith(`${keep}#`)) {
      await Promise.all([
        tx.objectStore('chapters').delete(id),
        tx.objectStore('contents').delete(id),
      ])
      excess--
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

/**
 * Lưu (hoặc làm mới) các chương; giữ readAt/progress đã có, chương đã ghim vẫn ghim. Sau đó dọn
 * chương không ghim vượt giới hạn (trừ truyện vừa lưu). Bộ nhớ đầy thì dọn 20% rồi thử lại một
 * lần; vẫn đầy thì ném OfflineStorageFullError.
 */
export async function saveChapters(
  chapters: ChapterContent[],
  { pinned = false }: { pinned?: boolean } = {},
) {
  const db = await database()
  if (!db || chapters.length === 0) return
  const keep = chapters[0].story.slug
  void requestPersistence()
  try {
    await put(db, chapters, pinned)
  } catch (error) {
    if (!isQuotaError(error)) throw error
    await evict(db, keep, 0.2)
    try {
      await put(db, chapters, pinned)
    } catch (retryError) {
      throw isQuotaError(retryError) ? new OfflineStorageFullError() : retryError
    }
  }
  await evict(db, keep)
}

/** Ghi đã đọc chương (và vị trí cuộn nếu có); chương chưa lưu thì bỏ qua */
export async function markRead(slug: string, number: number, progress?: number) {
  const db = await database()
  if (!db) return
  const tx = db.transaction('chapters', 'readwrite')
  const record = await tx.store.get(idOf(slug, number))
  if (record) {
    const now = new Date().toISOString()
    await tx.store.put({ ...record, readAt: now, usedAt: now, progress: progress ?? record.progress })
  }
  await tx.done
}

/** Ghim các chương đã có (người đọc tải về khoảng chương chứa chúng) */
export async function pinChapters(slug: string, numbers: number[]) {
  const db = await database()
  if (!db || numbers.length === 0) return
  const tx = db.transaction('chapters', 'readwrite')
  await Promise.all([
    ...numbers.map(async (number) => {
      const record = await tx.store.get(idOf(slug, number))
      if (record && record.pinned === 0) await tx.store.put({ ...record, pinned: 1 })
    }),
    tx.done,
  ])
}

/**
 * Lần theo chương sau (`next`) của các chương đã lưu từ chương `from`, tối đa `limit` chương. Trả
 * các chương đã có và chương đầu tiên còn thiếu (null: đủ `limit` chương, hoặc tới chương cuối).
 */
export async function walkSaved(
  slug: string,
  from: number,
  limit: number,
): Promise<{ saved: number[]; missing: number | null }> {
  const db = await database()
  if (!db) return { saved: [], missing: from }
  const store = db.transaction('chapters').store
  const saved: number[] = []
  let next: number | null = from
  while (next !== null && saved.length < limit) {
    const record = await store.get(idOf(slug, next))
    if (!record) return { saved, missing: next }
    saved.push(next)
    next = record.meta.next?.number ?? null
  }
  return { saved, missing: null }
}

/** Các truyện có chương trong kho, dùng gần nhất trước */
export async function listSavedStories(): Promise<SavedStory[]> {
  const db = await database()
  if (!db) return []
  const bySlug = new Map<string, ChapterRecord[]>()
  for (const record of await db.getAll('chapters')) {
    const list = bySlug.get(record.slug) ?? []
    list.push(record)
    bySlug.set(record.slug, list)
  }
  return [...bySlug.values()]
    .map((list): SavedStory => {
      list.sort((a, b) => a.number - b.number)
      const read = list
        .filter((r) => r.readAt !== null)
        .sort((a, b) => b.readAt!.localeCompare(a.readAt!))[0]
      // Thông tin truyện lấy từ bản lưu mới nhất
      const latest = list.reduce((a, b) => (b.savedAt > a.savedAt ? b : a))
      const resume = read ?? list[0]
      return {
        story: latest.meta.story,
        numbers: list.map((r) => r.number),
        pinned: list.some((r) => r.pinned === 1),
        bytes: list.reduce((sum, r) => sum + r.bytes, 0),
        resume: { number: resume.number, progress: resume.progress ?? 0 },
        usedAt: list.reduce((max, r) => (r.usedAt > max ? r.usedAt : max), ''),
      }
    })
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
}

/** Các chương đã lưu của một truyện (số và tên), tăng dần */
export async function savedChapterList(slug: string): Promise<ChapterNeighbor[]> {
  const db = await database()
  if (!db) return []
  const records = await db.getAllFromIndex('chapters', 'bySlug', slug)
  return records
    .sort((a, b) => a.number - b.number)
    .map((r) => ({ number: r.number, title: r.meta.title }))
}

export async function removeSavedChapter(slug: string, number: number) {
  const db = await database()
  if (!db) return
  const id = idOf(slug, number)
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  await Promise.all([
    tx.objectStore('chapters').delete(id),
    tx.objectStore('contents').delete(id),
    tx.done,
  ])
}

export async function removeSavedStory(slug: string) {
  const db = await database()
  if (!db) return
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  const ids = await tx.objectStore('chapters').index('bySlug').getAllKeys(slug)
  await Promise.all([
    ...ids.flatMap((id) => [
      tx.objectStore('chapters').delete(id),
      tx.objectStore('contents').delete(id),
    ]),
    tx.done,
  ])
}

export async function clearSaved() {
  const db = await database()
  if (!db) return
  const tx = db.transaction(['chapters', 'contents'], 'readwrite')
  await Promise.all([tx.objectStore('chapters').clear(), tx.objectStore('contents').clear(), tx.done])
}
```

- [ ] **Step 9: Chạy test, xác nhận qua; chạy toàn bộ test để chắc setup mới không làm hỏng test cũ**

Run: `npx vitest run src/lib/network.test.ts src/hooks/useOnline.test.ts src/features/offline/store.test.ts && npm test && npm run typecheck && npm run lint`
Expected: PASS hết. Nếu `vi.stubGlobal('indexedDB', ...)` trong setup báo lỗi kiểu, giữ nguyên `vi.stubGlobal` (không gán thẳng `globalThis.indexedDB`).

- [ ] **Step 10: Commit**

```bash
npx prettier --write src/lib/network.ts src/lib/network.test.ts src/hooks/useOnline.ts src/hooks/useOnline.test.ts src/features/offline src/test
git add package.json package-lock.json src/lib/network.ts src/lib/network.test.ts src/hooks/useOnline.ts src/hooks/useOnline.test.ts src/features/offline src/test
git commit -F - <<'EOF'
Đọc offline: kho chương IndexedDB, nhận biết lỗi mạng

store.ts lưu chương (thông tin và nội dung tách store), ghim, dọn chương lâu
không dùng khi vượt 300 chương hoặc bộ nhớ đầy; không có IndexedDB thì coi như
kho trống. Test dùng fake-indexeddb, mỗi test một kho mới.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Đọc chương qua kho trên máy

**Files:**
- Create: `src/features/offline/readChapter.ts`
- Create: `src/features/offline/components/NotSavedNotice.tsx`
- Create: `src/features/offline/offline-reading.test.tsx`
- Modify: `src/features/chapters/hooks.ts`
- Modify: `src/pages/ChapterReaderPage.tsx`
- Modify: `src/features/reader/components/ChapterStream.tsx`
- Modify: `src/features/reader/useReadingTracker.ts`
- Modify: `src/lib/routes.ts`

**Interfaces:**
- Consumes: `getSavedChapter`, `saveChapters`, `removeSavedChapter`, `markRead` (Task 2); `getChapter` (Task 1); `isNetworkError`.
- Produces:
  - `class ChapterNotSavedError extends Error`
  - `readChapter(slug, number, onFresh: (chapter: ChapterContent | null) => void): Promise<ChapterContent | null>`
  - `chapterQuery(queryClient: QueryClient, slug: string, number: number)` (queryOptions dùng chung cho `useChapter`, prefetch, `useFetchChapter`)
  - `NotSavedNotice({ number, onRetry })`
  - `paths.savedChapters = '/library?tab=saved'`

- [ ] **Step 1: Viết test hỏng**

`src/features/offline/offline-reading.test.tsx`:

```tsx
import { cleanup, screen } from '@testing-library/react'
import { getChapter } from '@/features/chapters/api'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getSavedChapter, listSavedStories } from './store'

// Bọc getChapter để từng test giả lỗi mạng hoặc bản mới trên máy chủ
vi.mock('@/features/chapters/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/chapters/api')>()
  return { ...api, getChapter: vi.fn(api.getChapter) }
})
const actual =
  await vi.importActual<typeof import('@/features/chapters/api')>('@/features/chapters/api')

const slug = 'truong-an-khong-tuyet' // 412 chương
const base = `/story/${slug}`
const heading = () => screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
  vi.mocked(getChapter).mockImplementation(actual.getChapter)
})

/** Mở chương khi có mạng cho chương vào kho, rồi đóng trang */
async function openOnce(number: number) {
  renderApp(`${base}/chapter-${number}`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, number), { timeout: 3000 }).not.toBeNull()
  cleanup()
}

test('chương đã mở được lưu; mất mạng mở lại vẫn đọc được, không gọi mạng', async () => {
  await openOnce(12)
  goOffline()
  vi.mocked(getChapter).mockClear()
  renderApp(`${base}/chapter-12`)
  await heading()
  expect(screen.getAllByText('Chương 12').length).toBeGreaterThan(0)
  expect(getChapter).not.toHaveBeenCalled()
})

test('mất mạng, chương chưa lưu: báo chưa lưu, có link tới truyện đã lưu', async () => {
  goOffline()
  renderApp(`${base}/chapter-30`)
  expect(
    await screen.findByText('Chương 30 chưa được lưu để đọc offline.', undefined, {
      timeout: 3000,
    }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Truyện đã lưu' })).toHaveAttribute(
    'href',
    '/library?tab=saved',
  )
})

test('máy báo có mạng nhưng tải lỗi mạng: cũng báo chưa lưu', async () => {
  vi.mocked(getChapter).mockRejectedValue(new TypeError('Failed to fetch'))
  renderApp(`${base}/chapter-30`)
  expect(
    await screen.findByText('Chương 30 chưa được lưu để đọc offline.', undefined, {
      timeout: 3000,
    }),
  ).toBeInTheDocument()
})

test('bản lưu cũ: hiện ngay rồi cập nhật theo bản mới trên máy chủ', async () => {
  await openOnce(12)
  vi.mocked(getChapter).mockImplementation(async (s, n) => {
    const chapter = await actual.getChapter(s, n)
    return chapter && n === 12 ? { ...chapter, content: '<p>Bản đã sửa của tác giả.</p>' } : chapter
  })
  renderApp(`${base}/chapter-12`)
  expect(
    await screen.findByText('Bản đã sửa của tác giả.', undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
  await expect
    .poll(async () => (await getSavedChapter(slug, 12))?.content)
    .toBe('<p>Bản đã sửa của tác giả.</p>')
})

test('chương không còn trên máy chủ: xóa bản lưu, trang báo không tìm thấy', async () => {
  await openOnce(12)
  vi.mocked(getChapter).mockImplementation(async (s, n) =>
    n === 12 ? null : actual.getChapter(s, n),
  )
  renderApp(`${base}/chapter-12`)
  expect(
    await screen.findByText(/Không tìm thấy chương 12/, undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
  await expect.poll(() => getSavedChapter(slug, 12)).toBeNull()
})

test('mở chương thì bản lưu ghi "đã đọc" (tab Đã lưu đọc tiếp đúng chương)', async () => {
  const { user, router } = renderApp(`${base}/chapter-12`)
  await heading()
  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chapter-13`)
  await expect
    .poll(async () => (await listSavedStories())[0]?.resume.number, { timeout: 3000 })
    .toBe(13)
})
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/features/offline/offline-reading.test.tsx`
Expected: FAIL (chương không được lưu vào kho; không có thông báo "chưa được lưu").

- [ ] **Step 3: `paths.savedChapters`**

`src/lib/routes.ts`, sau dòng `readingHistory: '/library?tab=history',`:

```ts
  /** Tab "Đã lưu" của tủ truyện: chương đọc được khi không có mạng */
  savedChapters: '/library?tab=saved',
```

- [ ] **Step 4: `src/features/offline/readChapter.ts`**

```ts
// Đọc một chương cho trang đọc qua kho trên máy: có bản lưu thì trả ngay (không chờ mạng) và làm
// mới ở nền; chưa có thì tải mạng rồi lưu, để lần sau hoặc lúc mất mạng đọc được ngay.
import { getChapter } from '@/features/chapters/api'
import { isNetworkError } from '@/lib/network'
import type { ChapterContent } from '@/types/chapter'
import { getSavedChapter, removeSavedChapter, saveChapters } from './store'

/** Mất mạng mà chương chưa được lưu trên máy */
export class ChapterNotSavedError extends Error {
  constructor() {
    super('Chương này chưa được lưu để đọc offline.')
    this.name = 'ChapterNotSavedError'
  }
}

/** Phần người đọc thấy của chương; khác nhau thì bản lưu đã cũ */
const fingerprint = (c: ChapterContent) =>
  JSON.stringify([c.title, c.content, c.publishedAt, c.prev, c.next, c.story])

async function refresh(
  slug: string,
  number: number,
  saved: ChapterContent,
  onFresh: (chapter: ChapterContent | null) => void,
) {
  try {
    const fresh = await getChapter(slug, number)
    if (!fresh) {
      // Chương bị ẩn, truyện bị gỡ: không giữ bản lưu nữa
      await removeSavedChapter(slug, number)
      onFresh(null)
    } else if (fingerprint(fresh) !== fingerprint(saved)) {
      await saveChapters([fresh]).catch(() => {})
      onFresh(fresh)
    }
  } catch {
    // Mạng yếu/mất mạng: giữ bản lưu
  }
}

/**
 * @param onFresh nhận bản mới khi bản lưu đã cũ (null: chương không còn đọc được)
 */
export async function readChapter(
  slug: string,
  number: number,
  onFresh: (chapter: ChapterContent | null) => void,
): Promise<ChapterContent | null> {
  const saved = await getSavedChapter(slug, number).catch(() => null)
  if (saved) {
    if (navigator.onLine) void refresh(slug, number, saved, onFresh)
    return saved
  }
  if (!navigator.onLine) throw new ChapterNotSavedError()
  let chapter: ChapterContent | null
  try {
    chapter = await getChapter(slug, number)
  } catch (error) {
    throw isNetworkError(error) ? new ChapterNotSavedError() : error
  }
  // Lưu xong mới trả về để trang đọc ghi được "đã đọc" vào bản lưu; lưu lỗi (bộ nhớ đầy) vẫn đọc
  if (chapter) await saveChapters([chapter]).catch(() => {})
  return chapter
}
```

- [ ] **Step 5: `chapterQuery` trong `src/features/chapters/hooks.ts`**

Sửa import đầu file:

```ts
import {
  keepPreviousData,
  type QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { ChapterNotSavedError, readChapter } from '@/features/offline/readChapter'
```

Thay `useChapter`, `usePrefetchChapter`, `useFetchChapter` bằng:

```ts
/**
 * Query một chương cho trang đọc, qua kho trên máy (features/offline). networkMode 'always': mặc
 * định TanStack Query dừng query khi máy offline, trang đọc sẽ kẹt ở khung chờ dù chương đã lưu.
 */
export const chapterQuery = (queryClient: QueryClient, slug: string, number: number) =>
  queryOptions({
    queryKey: chapterKeys.detail(slug, number),
    queryFn: () =>
      readChapter(slug, number, (fresh) =>
        queryClient.setQueryData(chapterKeys.detail(slug, number), fresh),
      ),
    networkMode: 'always',
    // Chưa lưu mà mất mạng: báo ngay, thử lại cũng vậy
    retry: (count, error) => !(error instanceof ChapterNotSavedError) && count < 3,
  })

export function useChapter(slug: string, number: number) {
  const queryClient = useQueryClient()
  return useQuery(chapterQuery(queryClient, slug, number))
}

/** Tải trước chương kế để bấm "Chương sau" là có ngay */
export function usePrefetchChapter(slug: string, number: number | undefined) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (number === undefined) return
    void queryClient.prefetchQuery(chapterQuery(queryClient, slug, number))
  }, [queryClient, slug, number])
}

/** Lấy một chương qua cache (dùng ngoài render, vd giọng đọc cần nội dung chương kế) */
export function useFetchChapter() {
  const queryClient = useQueryClient()
  return useCallback(
    (slug: string, number: number) => queryClient.fetchQuery(chapterQuery(queryClient, slug, number)),
    [queryClient],
  )
}
```

- [ ] **Step 6: `src/features/offline/components/NotSavedNotice.tsx`**

```tsx
import { WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/routes'

/** Mất mạng mà chương chưa được lưu (trang đọc, cuộn liên tục) */
export function NotSavedNotice({ number, onRetry }: { number: number; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      <p>Chương {number} chưa được lưu để đọc offline.</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Có mạng lại thì bấm "Thử lại", hoặc đọc các truyện đã lưu trên máy.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button className="rounded-full" onClick={onRetry}>
          Thử lại
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to={paths.savedChapters}>Truyện đã lưu</Link>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Trang đọc và cuộn liên tục dùng thông báo**

`src/pages/ChapterReaderPage.tsx`:
- thêm import `import { NotSavedNotice } from '@/features/offline/components/NotSavedNotice'` và `import { ChapterNotSavedError } from '@/features/offline/readChapter'`;
- dòng `const { data: chapter, isPending, isError, refetch } = useChapter(slug, number)` thành `const { data: chapter, isPending, isError, error, refetch } = useChapter(slug, number)`;
- thay khối `if (isError) return (...)` bằng:

```tsx
  if (isError)
    return error instanceof ChapterNotSavedError ? (
      <div className="px-4 py-32">
        <NotSavedNotice number={number} onRetry={() => void refetch()} />
      </div>
    ) : (
      <div className="flex flex-col items-center gap-4 px-4 py-32 text-center">
        <p>Không tải được chương này.</p>
        <Button className="rounded-full" onClick={() => void refetch()}>
          Thử lại
        </Button>
      </div>
    )
```

`src/features/reader/components/ChapterStream.tsx`, trong `StreamChapter`: thêm hai import như trên; dòng `useChapter` thêm `error`; ngay trước `if (isError || !chapter) {` thêm:

```tsx
  if (isError && error instanceof ChapterNotSavedError) {
    return (
      <div className="mt-24">
        <NotSavedNotice number={number} onRetry={() => void refetch()} />
      </div>
    )
  }
```

- [ ] **Step 8: Ghi "đã đọc" vào bản lưu**

`src/features/reader/useReadingTracker.ts`: thêm `import { markRead } from '@/features/offline/store'`. Trong effect "Mở chương", sau dòng `save({ slug, chapter: number, chapterTitle: title })` thêm:

```ts
    void markRead(slug, number).catch(() => {})
```

Trong hàm `flush`, thay dòng `if (el) save({ slug, chapter: number, chapterTitle: title, progress: progressOf(el) })` bằng:

```ts
      if (!el) return
      const progress = progressOf(el)
      save({ slug, chapter: number, chapterTitle: title, progress })
      // Bản lưu trên máy nhớ chỗ đọc để "Đọc tiếp" ở tab Đã lưu (cả khi offline)
      void markRead(slug, number, progress).catch(() => {})
```

- [ ] **Step 9: Chạy test**

Run: `npx vitest run src/features/offline src/features/reader src/features/chapters && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
npx prettier --write src/features/offline src/features/chapters/hooks.ts src/pages/ChapterReaderPage.tsx src/features/reader src/lib/routes.ts
git add src/features/offline src/features/chapters/hooks.ts src/pages/ChapterReaderPage.tsx src/features/reader src/lib/routes.ts
git commit -F - <<'EOF'
Đọc offline: trang đọc lấy chương qua kho trên máy

Có bản lưu thì hiện ngay và làm mới ở nền (bản mới khác thì cập nhật, chương
không còn thì xóa bản lưu); chưa lưu mà mất mạng thì báo "chưa được lưu" kèm
link truyện đã lưu. Mở/cuộn chương ghi chỗ đọc vào bản lưu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Tự tải trước 5 chương

**Files:**
- Create: `src/features/offline/prefetch.ts`
- Create: `src/features/offline/prefetch.test.tsx`
- Modify: `src/features/chapters/hooks.ts` (bỏ `usePrefetchChapter`)
- Modify: `src/pages/ChapterReaderPage.tsx`

**Interfaces:**
- Consumes: `walkSaved`, `saveChapters` (Task 2); `getChapterRange` (Task 1); `chapterKeys` (Task 1/3).
- Produces: `PREFETCH_COUNT = 5`; `prefetchFrom(slug: string, from: number): Promise<ChapterContent[]>`; `usePrefetchChapters(chapter: ChapterContent | null | undefined): void`.

- [ ] **Step 1: Viết test hỏng**

`src/features/offline/prefetch.test.tsx`:

```tsx
import { act, cleanup, screen } from '@testing-library/react'
import { getChapterRange } from '@/features/chapters/api'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getSavedChapter } from './store'

vi.mock('@/features/chapters/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/chapters/api')>()
  return { ...api, getChapterRange: vi.fn(api.getChapterRange) }
})

const slug = 'truong-an-khong-tuyet'
const base = `/story/${slug}`
const heading = () => screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
  vi.mocked(getChapterRange).mockClear()
})

test('mở chương thì 5 chương sau vào kho; mất mạng vẫn đọc tiếp được', async () => {
  const { router, user } = renderApp(`${base}/chapter-12`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, 17), { timeout: 3000 }).not.toBeNull()
  expect(await getSavedChapter(slug, 18)).toBeNull()

  goOffline()
  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chapter-13`)
  expect(
    await screen.findByRole('link', { name: /Đọc tiếp chương 14/ }, { timeout: 3000 }),
  ).toBeInTheDocument()

  await act(() => router.navigate(`${base}/chapter-18`))
  expect(
    await screen.findByText('Chương 18 chưa được lưu để đọc offline.', undefined, {
      timeout: 3000,
    }),
  ).toBeInTheDocument()
})

test('chương đã có trong máy thì không tải lại', async () => {
  renderApp(`${base}/chapter-12`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, 17), { timeout: 3000 }).not.toBeNull()
  cleanup()
  vi.mocked(getChapterRange).mockClear()

  renderApp(`${base}/chapter-13`)
  await heading()
  await expect
    .poll(() => vi.mocked(getChapterRange).mock.calls, { timeout: 3000 })
    .toEqual([[slug, 18, 1]])
})

test('máy bật tiết kiệm dữ liệu thì không tải trước', async () => {
  Object.defineProperty(navigator, 'connection', {
    value: { saveData: true },
    configurable: true,
  })
  try {
    renderApp(`${base}/chapter-12`)
    await heading()
    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(getChapterRange).not.toHaveBeenCalled()
  } finally {
    delete (navigator as { connection?: unknown }).connection
  }
})
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/features/offline/prefetch.test.tsx`
Expected: FAIL (chương 17 không có trong kho; `getChapterRange` không được gọi).

- [ ] **Step 3: `src/features/offline/prefetch.ts`**

```ts
// Tải trước vài chương kế tiếp vào kho trên máy khi đang có mạng, để mất mạng giữa chừng vẫn đọc
// tiếp được. Không tải khi máy bật tiết kiệm dữ liệu.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getChapterRange } from '@/features/chapters/api'
import { chapterKeys } from '@/features/chapters/hooks'
import type { ChapterContent } from '@/types/chapter'
import { saveChapters, walkSaved } from './store'

/** Số chương tải trước sau chương đang đọc */
export const PREFETCH_COUNT = 5

const saveData = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

/** Chạy `task` khi trình duyệt rảnh (sau khi trang đọc đã hiện); trả hàm hủy */
function whenIdle(task: () => void) {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(task, { timeout: 3000 })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(task, 300)
  return () => clearTimeout(id)
}

/** Tải các chương còn thiếu trong PREFETCH_COUNT chương tính từ chương `from`; trả chương vừa tải */
export async function prefetchFrom(slug: string, from: number): Promise<ChapterContent[]> {
  if (!navigator.onLine || saveData()) return []
  const { saved, missing } = await walkSaved(slug, from, PREFETCH_COUNT)
  if (missing === null) return []
  const chapters = await getChapterRange(slug, missing, PREFETCH_COUNT - saved.length)
  await saveChapters(chapters)
  return chapters
}

/** Trang đọc: mở chương xong thì tải trước các chương sau; chương ngay sau vào luôn cache */
export function usePrefetchChapters(chapter: ChapterContent | null | undefined) {
  const queryClient = useQueryClient()
  const slug = chapter?.story.slug
  const next = chapter?.next?.number
  useEffect(() => {
    if (slug === undefined || next === undefined) return
    return whenIdle(() => {
      prefetchFrom(slug, next)
        .then((chapters) => {
          const first = chapters.find((c) => c.number === next)
          if (first) queryClient.setQueryData(chapterKeys.detail(slug, next), first)
        })
        .catch(() => {
          // Mạng yếu, bộ nhớ đầy: bỏ qua, lần mở chương sau thử lại
        })
    })
  }, [queryClient, slug, next])
}
```

- [ ] **Step 4: Thay `usePrefetchChapter`**

`src/features/chapters/hooks.ts`: xóa hàm `usePrefetchChapter` (và `useEffect` khỏi import nếu không còn dùng — `useRecordChapterView` vẫn dùng `useEffect`, giữ lại).

`src/pages/ChapterReaderPage.tsx`: import thành `import { useChapter, useRecordChapterView } from '@/features/chapters/hooks'`, thêm `import { usePrefetchChapters } from '@/features/offline/prefetch'`, thay dòng `usePrefetchChapter(slug, chapter?.next?.number)` bằng:

```tsx
  usePrefetchChapters(chapter)
```

- [ ] **Step 5: Chạy test**

Run: `npx vitest run src/features/offline src/features/reader && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/features/offline src/features/chapters/hooks.ts src/pages/ChapterReaderPage.tsx
git add src/features/offline src/features/chapters/hooks.ts src/pages/ChapterReaderPage.tsx
git commit -F - <<'EOF'
Đọc offline: tự tải trước 5 chương kế tiếp

Mở chương lúc có mạng thì tải các chương còn thiếu trong 5 chương sau vào kho
(một lần gọi getChapterRange), khi trình duyệt rảnh; bỏ qua khi bật tiết kiệm
dữ liệu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Tab "Đã lưu" và phiên đăng nhập khi offline

**Files:**
- Create: `src/features/offline/hooks.ts`
- Create: `src/features/offline/components/SavedList.tsx`
- Create: `src/features/offline/saved-list.test.tsx`
- Modify: `src/lib/format.ts`, `src/lib/format.test.ts`
- Modify: `src/pages/LibraryPage.tsx`
- Modify: `src/features/auth/hooks.ts`

**Interfaces:**
- Consumes: `listSavedStories`, `savedChapterList`, `removeSavedStory`, `clearSaved`, `SavedStory` (Task 2); `paths.savedChapters` (Task 3).
- Produces:
  - `offlineKeys = { all: ['offline'], stories: ['offline', 'stories'], chapters: (slug) => ['offline', 'chapters', slug] }`
  - `useSavedStories()`, `useSavedChapters(slug)`, `useRemoveSavedStory()`, `useClearSaved()`
  - `formatBytes(bytes: number): string`
  - `SavedList` component

- [ ] **Step 1: Viết test hỏng**

`src/lib/format.test.ts`: sửa import thành `import { formatBytes, formatRelativeTime } from './format'`, thêm:

```ts
test('formatBytes', () => {
  expect(formatBytes(0)).toBe('0 KB')
  expect(formatBytes(300)).toBe('1 KB')
  expect(formatBytes(850 * 1024)).toBe('850 KB')
  expect(formatBytes(1.25 * 1024 * 1024)).toBe('1,3 MB')
})
```

`src/features/offline/saved-list.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import { registerUser } from '@/test/helpers'
import { fakeChapter, goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { listSavedStories, markRead, saveChapters } from './store'

const chapters = (slug: string, title: string, numbers: number[]) =>
  numbers.map((n) => fakeChapter(slug, n, { title }))
const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

test('liệt kê truyện có chương trong máy; "Đọc tiếp" mở chương đọc gần nhất', async () => {
  at('2026-09-01T00:00:00Z')
  await saveChapters(chapters('mua-ha', 'Mùa Hạ', [1, 2, 3]))
  at('2026-09-02T00:00:00Z')
  await saveChapters(chapters('dem-trang', 'Đêm Trắng', [7, 8]), { pinned: true })
  at('2026-09-03T00:00:00Z')
  await markRead('mua-ha', 2, 0.4)

  renderApp('/library?tab=saved')
  const list = await screen.findByRole('list', { name: 'Truyện đã lưu' }, { timeout: 3000 })
  const [first, second] = within(list).getAllByRole('listitem')
  expect(first).toHaveTextContent('Mùa Hạ')
  expect(first).toHaveTextContent('Đã lưu 3 chương (1–3)')
  expect(first).not.toHaveTextContent('Đã tải về')
  expect(within(first).getByRole('link', { name: 'Đọc tiếp' })).toHaveAttribute(
    'href',
    '/story/mua-ha/chapter-2',
  )
  expect(second).toHaveTextContent('Đêm Trắng')
  expect(second).toHaveTextContent('Đã tải về')
  expect(within(second).getByRole('link', { name: 'Đọc tiếp' })).toHaveAttribute(
    'href',
    '/story/dem-trang/chapter-7',
  )
  expect(screen.getByRole('link', { name: 'Đã lưu' })).toHaveAttribute('aria-current', 'page')
})

test('xóa một truyện; "Xóa tất cả" hỏi lại rồi xóa hết', async () => {
  await saveChapters(chapters('mua-ha', 'Mùa Hạ', [1]))
  await saveChapters(chapters('dem-trang', 'Đêm Trắng', [1]))
  const { user } = renderApp('/library?tab=saved')

  await user.click(
    await screen.findByRole('button', { name: 'Xóa Mùa Hạ khỏi máy' }, { timeout: 3000 }),
  )
  await expect.poll(() => screen.queryByText('Mùa Hạ')).toBeNull()
  expect((await listSavedStories()).map((s) => s.story.title)).toEqual(['Đêm Trắng'])

  await user.click(screen.getByRole('button', { name: 'Xóa tất cả' }))
  const dialog = await screen.findByRole('dialog', { name: 'Xóa mọi chương đã lưu?' })
  await user.click(within(dialog).getByRole('button', { name: 'Xóa hết' }))
  expect(await screen.findByText('Chưa có chương nào được lưu')).toBeInTheDocument()
  expect(await listSavedStories()).toEqual([])
})

test('mất mạng vẫn mở được tab Đã lưu, vẫn nhận ra tài khoản đang đăng nhập', async () => {
  await registerUser()
  await saveChapters(chapters('mua-ha', 'Mùa Hạ', [1]))
  goOffline()
  renderApp('/library?tab=saved')
  expect(await screen.findByText('Mùa Hạ', undefined, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Tài khoản của Linh/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/lib/format.test.ts src/features/offline/saved-list.test.tsx`
Expected: FAIL (`formatBytes` chưa có; không có tab "Đã lưu"; test offline kẹt ở khung chờ vì query phiên bị dừng).

- [ ] **Step 3: `formatBytes`**

`src/lib/format.ts`, thêm cuối file:

```ts
const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

/** Dung lượng: 870400 → "850 KB", 1310720 → "1,3 MB" */
export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${decimal.format(bytes / (1024 * 1024))} MB`
}
```

- [ ] **Step 4: Phiên đăng nhập không bị dừng khi offline**

`src/features/auth/hooks.ts`, thay `useSession`:

```ts
/** networkMode 'always': phiên đọc trên máy, mở app lúc offline vẫn biết ai đang đăng nhập */
export const useSession = () =>
  useQuery({
    queryKey: authKeys.session,
    queryFn: api.getSession,
    staleTime: Infinity,
    networkMode: 'always',
  })
```

- [ ] **Step 5: `src/features/offline/hooks.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as store from './store'

export const offlineKeys = {
  all: ['offline'] as const,
  stories: ['offline', 'stories'] as const,
  chapters: (slug: string) => ['offline', 'chapters', slug] as const,
}

// Kho nằm trên máy: chạy cả khi offline (networkMode 'always'), mỗi lần mở đều đọc lại (staleTime 0)
const local = { networkMode: 'always', staleTime: 0 } as const

export const useSavedStories = () =>
  useQuery({ queryKey: offlineKeys.stories, queryFn: store.listSavedStories, ...local })

export const useSavedChapters = (slug: string) =>
  useQuery({
    queryKey: offlineKeys.chapters(slug),
    queryFn: () => store.savedChapterList(slug),
    ...local,
  })

function useInvalidateOffline() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: offlineKeys.all })
}

export function useRemoveSavedStory() {
  const invalidate = useInvalidateOffline()
  return useMutation({
    mutationFn: store.removeSavedStory,
    networkMode: 'always',
    onSuccess: invalidate,
  })
}

export function useClearSaved() {
  const invalidate = useInvalidateOffline()
  return useMutation({ mutationFn: store.clearSaved, networkMode: 'always', onSuccess: invalidate })
}
```

- [ ] **Step 6: `src/features/offline/components/SavedList.tsx`**

```tsx
import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { SectionError } from '@/components/common/SectionHeading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ListSkeleton } from '@/features/library/components/FollowingList'
import type { ResumeState } from '@/features/library/resume'
import { StoryCover } from '@/features/stories/StoryCover'
import { formatBytes } from '@/lib/format'
import { paths } from '@/lib/routes'
import { useClearSaved, useRemoveSavedStory, useSavedStories } from '../hooks'
import type { SavedStory } from '../store'

/** Tab "Đã lưu" của tủ truyện: chỉ đọc kho trên máy nên dùng được cả khi offline */
export function SavedList() {
  const { data, isPending, isError } = useSavedStories()

  if (isError) return <SectionError />
  if (isPending) return <ListSkeleton />
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-heading text-2xl font-semibold">Chưa có chương nào được lưu</p>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
          Chương bạn mở sẽ tự được lưu để đọc khi không có mạng. Muốn đọc cả truyện lúc offline thì
          bấm "Tải về đọc offline" ở trang truyện.
        </p>
      </div>
    )
  }

  const bytes = data.reduce((sum, s) => sum + s.bytes, 0)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.length} truyện · {formatBytes(bytes)} trên máy này
        </p>
        <ClearSavedButton />
      </div>
      <ul className="divide-y rounded-xl border bg-card/40" aria-label="Truyện đã lưu">
        {data.map((saved) => (
          <li key={saved.story.slug}>
            <SavedRow saved={saved} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SavedRow({ saved }: { saved: SavedStory }) {
  const remove = useRemoveSavedStory()
  const { story, numbers, resume } = saved
  const range = numbers.length > 1 ? `${numbers[0]}–${numbers.at(-1)}` : `${numbers[0]}`
  const resumeAt: ResumeState = { resume: resume.progress }

  return (
    <article className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center">
      <Link to={paths.story(story.slug)} tabIndex={-1} aria-hidden className="self-start">
        <StoryCover story={story} compact className="rounded" />
      </Link>
      <div className="min-w-0">
        <h3 className="font-medium">
          <Link to={paths.story(story.slug)} className="line-clamp-1 hover:text-primary">
            {story.title}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
          Đã lưu {numbers.length} chương ({range}) · {formatBytes(saved.bytes)}
        </p>
        {saved.pinned && (
          <Badge variant="secondary" className="mt-2">
            Đã tải về
          </Badge>
        )}
      </div>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <Button asChild className="h-9 flex-1 rounded-full px-4 sm:flex-none">
          <Link to={paths.chapter(story.slug, resume.number)} state={resumeAt}>
            Đọc tiếp
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-full text-muted-foreground hover:text-destructive"
          aria-label={`Xóa ${story.title} khỏi máy`}
          title="Xóa khỏi máy"
          disabled={remove.isPending}
          onClick={() => remove.mutate(story.slug)}
        >
          <Trash2 />
        </Button>
      </div>
    </article>
  )
}

function ClearSavedButton() {
  const clear = useClearSaved()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          Xóa tất cả
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Xóa mọi chương đã lưu?</DialogTitle>
          <DialogDescription>
            Chương đã lưu và đã tải về trên máy này sẽ bị xóa. Lịch sử đọc và tủ truyện vẫn được
            giữ.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Giữ lại</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" disabled={clear.isPending} onClick={() => clear.mutate()}>
              Xóa hết
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 7: Tab trong `src/pages/LibraryPage.tsx`**

- Thêm `import { SavedList } from '@/features/offline/components/SavedList'`.
- `type Tab = 'following' | 'history' | 'saved'`.
- Thay khối tính `tab`:

```tsx
  const requested = params.get('tab')
  // Khách mặc định xem lịch sử (tab theo dõi cần tài khoản)
  const tab: Tab =
    requested === 'saved'
      ? 'saved'
      : requested === 'history' || (!user && requested !== 'following')
        ? 'history'
        : 'following'
```

- Trong `items` của `SegmentedLinks`, thêm sau mục `history`:

```tsx
            {
              key: 'saved',
              to: { search: '?tab=saved' },
              active: tab === 'saved',
              label: 'Đã lưu',
            },
```

- Trong `<div className="mt-8">`, bọc nội dung hiện có: `{tab === 'saved' ? <SavedList /> : tab === 'history' ? (...khối lịch sử cũ...) : user ? (...) : (...)}`.
- Mô tả dưới tiêu đề đổi thành: `Truyện bạn theo dõi, những chương đang đọc dở và chương đã lưu để đọc offline.`

- [ ] **Step 8: Chạy test**

Run: `npx vitest run src/lib/format.test.ts src/features/offline src/features/library src/features/auth && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
npx prettier --write src/lib/format.ts src/lib/format.test.ts src/features/offline src/pages/LibraryPage.tsx src/features/auth/hooks.ts
git add src/lib/format.ts src/lib/format.test.ts src/features/offline src/pages/LibraryPage.tsx src/features/auth/hooks.ts
git commit -F - <<'EOF'
Tủ truyện: tab "Đã lưu" cho chương đọc offline

Liệt kê truyện có chương trên máy (số chương, dung lượng, nhãn "Đã tải về"),
"Đọc tiếp" mở chương đọc gần nhất, xóa từng truyện hoặc tất cả. Query phiên
đăng nhập chạy cả khi offline để mở app lúc mất mạng không kẹt ở khung chờ.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Giao diện khi offline

**Files:**
- Create: `src/components/common/OfflineBanner.tsx`
- Create: `src/components/common/RouteError.tsx`, `src/components/common/RouteError.test.tsx`
- Create: `src/features/offline/offline-ui.test.tsx`
- Create: `src/features/stories/StoryCover.test.tsx`
- Create: `src/features/auth/api.remote.test.ts`
- Modify: `src/layouts/MainLayout.tsx`, `src/app/router.tsx`
- Modify: `src/features/reader/components/ReaderChapterIndex.tsx`
- Modify: `src/features/reader/components/ChapterComments.tsx`
- Modify: `src/features/feedback/components/ReportChapterDialog.tsx`
- Modify: `src/features/stories/StoryCover.tsx`
- Modify: `src/features/auth/api.remote.ts`

**Interfaces:**
- Consumes: `useOnline` (Task 2), `useSavedChapters` (Task 5), `paths.savedChapters`, `isNetworkError`.
- Produces: `OfflineBanner`, `RouteError` (gắn làm `ErrorBoundary` cho 4 route gốc).

- [ ] **Step 1: Viết test hỏng**

`src/features/offline/offline-ui.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { goOffline, goOnline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getSavedChapter } from './store'

const slug = 'truong-an-khong-tuyet'
const base = `/story/${slug}`
const heading = () => screen.findByRole('heading', { level: 1 }, { timeout: 3000 })

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
})

test('trang thường: mất mạng thì có dải báo offline kèm link truyện đã lưu', async () => {
  renderApp('/')
  await screen.findByRole('contentinfo', undefined, { timeout: 3000 })
  expect(screen.queryByText('Bạn đang offline.')).toBeNull()
  goOffline()
  expect(await screen.findByText('Bạn đang offline.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Xem truyện đã lưu' })).toHaveAttribute(
    'href',
    '/library?tab=saved',
  )
  goOnline()
  await expect.poll(() => screen.queryByText('Bạn đang offline.')).toBeNull()
})

test('mục lục khi mất mạng chỉ hiện chương đã lưu', async () => {
  const { user } = renderApp(`${base}/chapter-12`)
  await heading()
  await expect.poll(() => getSavedChapter(slug, 17), { timeout: 3000 }).not.toBeNull()
  goOffline()
  await user.click(screen.getByRole('button', { name: 'Mục lục' }))
  const dialog = await screen.findByRole('dialog', { name: 'Mục lục' })
  expect(await within(dialog).findByText('Đang offline, các chương đã lưu:')).toBeInTheDocument()
  const chapters = within(dialog)
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'))
    .filter((href) => href?.includes('/chapter-'))
  expect(chapters).toEqual([12, 13, 14, 15, 16, 17].map((n) => `${base}/chapter-${n}`))
})

test('mất mạng: khu bình luận báo cần mạng, nút báo lỗi bị khóa', async () => {
  renderApp(`${base}/chapter-12`)
  await heading()
  goOffline()
  expect(
    await screen.findByText('Cần có mạng để xem và gửi bình luận chương 12.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Báo lỗi chương' })).toBeDisabled()
})
```

`src/components/common/RouteError.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/router'
import { goOffline } from '@/test/offline'
import { RouteError } from './RouteError'

/** Route mà file JS của trang không tải được (như mở khu Sáng tác lúc offline) */
const failingRouter = () =>
  createMemoryRouter([
    {
      path: '/',
      ErrorBoundary: RouteError,
      lazy: async () => {
        throw new TypeError('Failed to fetch dynamically imported module')
      },
    },
  ])

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

test('mọi route gốc dùng RouteError', () => {
  expect(routes.every((r) => r.ErrorBoundary === RouteError)).toBe(true)
})

test('mất mạng: báo trang cần có mạng, có link truyện đã lưu', async () => {
  goOffline()
  render(<RouterProvider router={failingRouter()} />)
  expect(await screen.findByText('Bạn đang offline')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Truyện đã lưu' })).toHaveAttribute(
    'href',
    '/library?tab=saved',
  )
})

test('có mạng mà vẫn lỗi: gợi ý tải lại trang', async () => {
  render(<RouterProvider router={failingRouter()} />)
  expect(await screen.findByText('Không mở được trang này')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeInTheDocument()
})
```

`src/features/stories/StoryCover.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { StoryCover } from './StoryCover'

test('ảnh bìa không tải được (offline, ảnh bị xóa) thì dùng bìa chữ tự sinh', () => {
  const story = {
    slug: 'mua-ha',
    title: 'Mùa Hạ',
    coverUrl: 'https://x.supabase.co/storage/v1/object/public/covers/a.jpg',
    author: { slug: 'tac-gia', name: 'Tác giả' },
  }
  render(<StoryCover story={story} />)
  const image = screen.getByRole('img', { name: 'Bìa truyện Mùa Hạ' })
  expect(image.tagName).toBe('IMG')
  fireEvent.error(image)
  expect(screen.getByRole('img', { name: 'Bìa truyện Mùa Hạ' }).tagName).toBe('DIV')
})
```

`src/features/auth/api.remote.test.ts`:

```ts
// Bản Supabase của phiên đăng nhập trên client giả: chỉ kiểm phần chạy trên máy (hồ sơ lần trước
// dùng khi mở app lúc offline).
import type * as Remote from './api.remote'

const fake = vi.hoisted(() => ({
  profile: { data: null, error: null } as { data: unknown; error: unknown },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  db: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'u1', email: 'linh@gmail.com', app_metadata: {} } } },
      }),
    },
    from: () => {
      const query: Record<string, () => unknown> = {
        select: () => query,
        eq: () => query,
        single: async () => fake.profile,
      }
      return query
    },
  }),
}))

/** Như mở lại trang: module mới, hồ sơ không còn trong bộ nhớ */
async function freshApi(): Promise<typeof Remote> {
  vi.resetModules()
  return import('./api.remote')
}

const offlineError = { message: 'TypeError: Failed to fetch', code: '' }

beforeEach(() => localStorage.clear())

test('mở app lúc offline: dùng hồ sơ đã tải lần trước', async () => {
  fake.profile = { data: { id: 'u1', display_name: 'Linh', avatar_url: null }, error: null }
  expect(await (await freshApi()).getSession()).toMatchObject({ id: 'u1', displayName: 'Linh' })

  fake.profile = { data: null, error: offlineError }
  expect(await (await freshApi()).getSession()).toMatchObject({ id: 'u1', displayName: 'Linh' })
})

test('chưa có hồ sơ lần trước, hoặc lỗi không do mạng: vẫn báo lỗi', async () => {
  fake.profile = { data: null, error: offlineError }
  await expect((await freshApi()).getSession()).rejects.toMatchObject(offlineError)

  localStorage.setItem('auth-profile', JSON.stringify({ id: 'u1', displayName: 'Linh', avatarUrl: null }))
  fake.profile = { data: null, error: { code: 'PGRST116', message: 'No rows' } }
  await expect((await freshApi()).getSession()).rejects.toMatchObject({ code: 'PGRST116' })
})
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/features/offline/offline-ui.test.tsx src/components/common/RouteError.test.tsx src/features/stories/StoryCover.test.tsx src/features/auth/api.remote.test.ts`
Expected: FAIL (chưa có banner, `RouteError`, bìa dự phòng, hồ sơ lần trước).

- [ ] **Step 3: `src/components/common/OfflineBanner.tsx` và gắn vào `MainLayout`**

```tsx
import { WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { useOnline } from '@/hooks/useOnline'
import { paths } from '@/lib/routes'
import { Container } from './Container'

/** Dải dưới header khi mất mạng: các trang cần mạng giữ khung chờ, dải này giải thích lý do */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="border-b bg-secondary text-secondary-foreground">
      <Container className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 py-2 text-center text-sm">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>Bạn đang offline.</span>
        <Link
          to={paths.savedChapters}
          className="font-medium text-rose-gold underline-offset-4 hover:underline"
        >
          Xem truyện đã lưu
        </Link>
      </Container>
    </div>
  )
}
```

`src/layouts/MainLayout.tsx`: thêm `import { OfflineBanner } from '@/components/common/OfflineBanner'` và đặt `<OfflineBanner />` ngay sau `<Header />`.

- [ ] **Step 4: `src/components/common/RouteError.tsx` và gắn vào router**

```tsx
// Lỗi khi mở trang, thường là không tải được file JS của trang: mất mạng với trang không có trong
// bộ nhớ đệm (khu Sáng tác, Quản trị), hoặc web vừa lên phiên bản mới
import { WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/hooks/useOnline'
import { paths } from '@/lib/routes'

export function RouteError() {
  const online = useOnline()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
      {online ? (
        <>
          <p className="font-heading text-3xl font-semibold">Không mở được trang này</p>
          <p className="max-w-sm text-muted-foreground">
            Có thể web vừa được cập nhật. Tải lại trang để thử lại.
          </p>
        </>
      ) : (
        <>
          <WifiOff className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-heading text-3xl font-semibold">Bạn đang offline</p>
          <p className="max-w-sm text-muted-foreground">
            Trang này cần có mạng. Bạn vẫn đọc được các truyện đã lưu trên máy.
          </p>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button className="rounded-full" onClick={() => window.location.reload()}>
          Tải lại trang
        </Button>
        {!online && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to={paths.savedChapters}>Truyện đã lưu</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
```

`src/app/router.tsx`: thêm `import { RouteError } from '@/components/common/RouteError'`; trong 4 route gốc (`MainLayout`, `admin`, `ReaderLayout`, `AuthLayout`) thêm dòng `ErrorBoundary: RouteError,` ngay dưới `HydrateFallback: PageLoader,`.

- [ ] **Step 5: Mục lục trang đọc khi offline**

`src/features/reader/components/ReaderChapterIndex.tsx`:
- thêm import `import type { Ref } from 'react'`, `import { useSavedChapters } from '@/features/offline/hooks'`, `import { useOnline } from '@/hooks/useOnline'`, `import type { ChapterNeighbor } from '@/types/chapter'`;
- trong `ReaderChapterIndex`, thêm `const online = useOnline()` sau dòng `useChapterList`;
- thay nội dung `<div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">` bằng:

```tsx
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {!online && !data ? (
          <SavedIndex slug={slug} current={current} onNavigate={onNavigate} />
        ) : isError ? (
          <div className="p-2">
            <SectionError />
          </div>
        ) : (
          <ol
            aria-busy={isPending || isPlaceholderData}
            className={cn(isPlaceholderData && 'opacity-60 transition-opacity')}
          >
            {isPending
              ? Array.from({ length: 14 }, (_, i) => (
                  <li key={i} className="px-3 py-2.5">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  </li>
                ))
              : data.items.map((c) => (
                  <li key={c.number}>
                    <ChapterLink
                      slug={slug}
                      chapter={c}
                      active={c.number === current}
                      onNavigate={onNavigate}
                      linkRef={c.number === current ? currentRef : undefined}
                    />
                  </li>
                ))}
          </ol>
        )}
      </div>
```

- thêm cuối file:

```tsx
function ChapterLink({
  slug,
  chapter,
  active,
  onNavigate,
  linkRef,
}: {
  slug: string
  chapter: ChapterNeighbor
  active: boolean
  onNavigate: () => void
  linkRef?: Ref<HTMLAnchorElement>
}) {
  return (
    <Link
      ref={linkRef}
      to={paths.chapter(slug, chapter.number)}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
        active
          ? 'bg-primary/10 font-medium text-foreground ring-1 ring-primary/30'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="w-10 shrink-0 text-right tabular-nums opacity-70">{chapter.number}</span>
      <span className="min-w-0 truncate">{chapter.title}</span>
    </Link>
  )
}

/** Mất mạng: chỉ liệt kê chương đã lưu trên máy của truyện */
function SavedIndex({
  slug,
  current,
  onNavigate,
}: {
  slug: string
  current: number
  onNavigate: () => void
}) {
  const { data } = useSavedChapters(slug)
  if (!data) return null
  return (
    <div>
      <p className="px-3 pt-1 pb-2 text-sm text-muted-foreground">
        {data.length
          ? 'Đang offline, các chương đã lưu:'
          : 'Đang offline và truyện này chưa có chương nào được lưu.'}
      </p>
      <ol>
        {data.map((c) => (
          <li key={c.number}>
            <ChapterLink
              slug={slug}
              chapter={c}
              active={c.number === current}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ol>
    </div>
  )
}
```

- [ ] **Step 6: Bình luận và báo lỗi chương khi offline**

`src/features/reader/components/ChapterComments.tsx`: thêm `import { useOnline } from '@/hooks/useOnline'`; sau dòng `const total = data?.pages[0]?.total` thêm:

```tsx
  const online = useOnline()
  if (!online) {
    return (
      <p className="text-sm text-muted-foreground">
        Cần có mạng để xem và gửi bình luận chương {chapter}.
      </p>
    )
  }
```

`src/features/feedback/components/ReportChapterDialog.tsx`: thêm `import { useOnline } from '@/hooks/useOnline'`; trong `ReportChapterDialog` thêm `const online = useOnline()`; nút "Báo lỗi chương" thêm hai prop:

```tsx
        disabled={!online}
        title={online ? undefined : 'Cần có mạng để báo lỗi chương'}
```

- [ ] **Step 7: Bìa dự phòng khi ảnh lỗi**

`src/features/stories/StoryCover.tsx`: thêm `import { useState } from 'react'`; đầu hàm `StoryCover` và nhánh ảnh thành:

```tsx
export function StoryCover({ story, compact = false, className }: Props) {
  // Ảnh không tải được (offline chưa có trong bộ nhớ đệm, ảnh bị xóa): dùng bìa chữ tự sinh
  const [failed, setFailed] = useState<string | null>(null)
  if (story.coverUrl && failed !== story.coverUrl) {
    const url = story.coverUrl
    return (
      <img
        src={url}
        alt={`Bìa truyện ${story.title}`}
        loading="lazy"
        onError={() => setFailed(url)}
        className={cn('aspect-[2/3] w-full object-cover', className)}
      />
    )
  }
```

(phần bìa chữ giữ nguyên).

- [ ] **Step 8: Hồ sơ lần trước cho phiên Supabase khi offline**

`src/features/auth/api.remote.ts`: thêm import `import { isNetworkError } from '@/lib/network'` và `import { readMock, writeMock } from '@/lib/mockStorage'` (nếu file đã import từ `@/lib/mockStorage` thì gộp). Thay `loadProfile` bằng:

```ts
/** Hồ sơ lần tải trước (localStorage): mở app lúc offline vẫn nhận ra tài khoản */
const PROFILE_KEY = 'auth-profile'

async function loadProfile(userId: string): Promise<Profile> {
  if (cachedProfile?.id === userId) return cachedProfile
  let profile: Profile
  try {
    const row = unwrap(
      await db().from('profiles').select('id, display_name, avatar_url').eq('id', userId).single(),
    )
    profile = { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url }
  } catch (error) {
    const saved = readMock<Profile | null>(PROFILE_KEY, null)
    // Không gán cachedProfile: có mạng lại thì tải bản mới
    if (isNetworkError(error) && saved?.id === userId) return saved
    throw error
  }
  cachedProfile = profile
  writeMock(PROFILE_KEY, profile)
  return profile
}
```

Trong `onAuthStateChange`, callback của supabase-js thêm dòng đầu (trước `if (event === 'INITIAL_SESSION' ...`):

```ts
    // Đăng xuất (kể cả xóa tài khoản, phiên hết hạn): không giữ hồ sơ trên máy
    if (event === 'SIGNED_OUT') writeMock(PROFILE_KEY, null)
```

- [ ] **Step 9: Chạy test**

Run: `npx vitest run src/features/offline src/components/common src/features/stories src/features/auth src/features/reader && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
npx prettier --write src/components/common src/layouts/MainLayout.tsx src/app/router.tsx src/features/reader/components src/features/feedback/components/ReportChapterDialog.tsx src/features/stories src/features/auth src/features/offline
git add src/components/common src/layouts/MainLayout.tsx src/app/router.tsx src/features/reader/components src/features/feedback/components/ReportChapterDialog.tsx src/features/stories src/features/auth src/features/offline
git commit -F - <<'EOF'
Đọc offline: giao diện khi mất mạng

Dải "Bạn đang offline" dưới header; mục lục trang đọc chỉ hiện chương đã lưu;
bình luận báo cần mạng, nút báo lỗi bị khóa; bìa ảnh lỗi thì dùng bìa chữ;
RouteError thay màn hình lỗi mặc định khi không tải được trang; bản Supabase
nhớ hồ sơ lần trước để mở app lúc offline vẫn nhận đúng tài khoản.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Nút "Tải về đọc offline"

**Files:**
- Create (qua shadcn): `src/components/ui/sonner.tsx`
- Create: `src/features/offline/downloads.ts`
- Create: `src/features/offline/components/DownloadButton.tsx`
- Create: `src/features/offline/download.test.tsx`
- Modify: `src/app/providers.tsx`
- Modify: `src/features/stories/detail/StoryHero.tsx`
- Modify: `src/features/reader/components/ReaderChapterIndex.tsx`, `src/features/reader/components/ReaderToolbar.tsx`

**Interfaces:**
- Consumes: `walkSaved`, `pinChapters`, `saveChapters`, `OfflineStorageFullError` (Task 2); `getChapterRange`, `useChapterCountFrom` (Task 1); `offlineKeys`, `useSavedChapters` (Task 5); `formatBytes` (Task 5); `isNetworkError`, `useOnline`.
- Produces:
  - `DOWNLOAD_BATCH = 20`
  - `type Download = { status: 'running' | 'done' | 'cancelled' | 'failed'; done: number; total: number; bytes: number; error?: string }`
  - `useDownloads` (Zustand, `{ bySlug: Record<string, Download> }`)
  - `downloadChapters({ slug, title, from, total, onChange? }): Promise<void>`, `cancelDownload(slug)`
  - `DownloadButton({ slug, title, from, className? })`
  - `Toaster` trong `Providers`; `toast` của `sonner` dùng được ở mọi nơi (Task 9 dùng).

- [ ] **Step 1: Thêm sonner**

Run: `npx shadcn@latest add sonner`
Expected: tạo `src/components/ui/sonner.tsx`, cài `sonner` và `next-themes`.

Sửa `src/components/ui/sonner.tsx`: dòng `import { useTheme } from "next-themes"` (hoặc nháy đơn) thành `import { useTheme } from '@/hooks/useTheme'`; dòng `const { theme = "system" } = useTheme()` thành `const theme = useTheme((s) => s.theme)` (web tự quản theme bằng Zustand key `theme`, không dùng next-themes). Rồi:

Run: `npm uninstall next-themes`

`src/app/providers.tsx`: thêm `import { Toaster } from '@/components/ui/sonner'`; trong `QueryClientProvider`, sau `<TooltipProvider>{children}</TooltipProvider>` thêm `<Toaster position="bottom-center" />`.

- [ ] **Step 2: Viết test hỏng**

`src/features/offline/download.test.tsx`:

```tsx
import { act, screen, within } from '@testing-library/react'
import { getChapterRange } from '@/features/chapters/api'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { cancelDownload, downloadChapters, useDownloads } from './downloads'
import { getSavedChapter, listSavedStories, savedChapterList } from './store'

vi.mock('@/features/chapters/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@/features/chapters/api')>()
  return { ...api, getChapterRange: vi.fn(api.getChapterRange) }
})
const actual =
  await vi.importActual<typeof import('@/features/chapters/api')>('@/features/chapters/api')

const slug = 'truong-an-khong-tuyet' // 412 chương
const base = `/story/${slug}`
const title = 'Trường An'

beforeEach(() => {
  localStorage.clear()
  useDownloads.setState({ bySlug: {} })
  vi.mocked(getChapterRange).mockReset().mockImplementation(actual.getChapterRange)
})
afterEach(() => vi.restoreAllMocks())

test('tải 20 chương từ trang truyện; mất mạng vẫn đọc được chương thứ 20', async () => {
  const { user, router } = renderApp(base)
  await user.click(
    await screen.findByRole('button', { name: 'Tải về đọc offline' }, { timeout: 3000 }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Tải về đọc offline' })
  await user.click(await within(dialog).findByRole('button', { name: '20 chương' }))
  expect(
    (await screen.findAllByText(/Đã tải 20 chương/, undefined, { timeout: 5000 })).length,
  ).toBeGreaterThan(0)
  expect(await getSavedChapter(slug, 20)).not.toBeNull()
  expect(await listSavedStories()).toMatchObject([{ pinned: true, numbers: expect.any(Array) }])

  goOffline()
  await act(() => router.navigate(`${base}/chapter-20`))
  expect(await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.getAllByText('Chương 20').length).toBeGreaterThan(0)
})

test('hủy giữa chừng giữ chương đã tải; tải lại chỉ lấy phần còn thiếu', async () => {
  vi.mocked(getChapterRange).mockImplementationOnce(async (...args) => {
    const chapters = await actual.getChapterRange(...args)
    cancelDownload(slug)
    return chapters
  })
  await downloadChapters({ slug, title, from: 1, total: 50 })
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({ status: 'cancelled', done: 20 })
  expect(await savedChapterList(slug)).toHaveLength(20)

  vi.mocked(getChapterRange).mockClear()
  await downloadChapters({ slug, title, from: 1, total: 50 })
  expect(vi.mocked(getChapterRange).mock.calls).toEqual([
    [slug, 21, 20],
    [slug, 41, 10],
  ])
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({
    status: 'done',
    done: 50,
    total: 50,
  })
})

test('bộ nhớ đầy: dừng và báo đã tải được bao nhiêu chương', async () => {
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
    throw new DOMException('Hết chỗ', 'QuotaExceededError')
  })
  await downloadChapters({ slug, title, from: 1, total: 20 })
  expect(useDownloads.getState().bySlug[slug]).toMatchObject({
    status: 'failed',
    done: 0,
    error: 'Bộ nhớ máy đầy, đã tải được 0 chương.',
  })
})

test('mục lục trang đọc có nút tải về, tải từ chương đang đọc', async () => {
  const { user } = renderApp(`${base}/chapter-12`)
  await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })
  await user.click(screen.getByRole('button', { name: 'Mục lục' }))
  const index = await screen.findByRole('dialog', { name: 'Mục lục' })
  await user.click(within(index).getByRole('button', { name: 'Tải về đọc offline' }))
  expect(
    await screen.findByText(/Tải từ chương 12\./, undefined, { timeout: 3000 }),
  ).toBeInTheDocument()
})
```

- [ ] **Step 3: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/features/offline/download.test.tsx`
Expected: FAIL (không có module `./downloads`, không có nút "Tải về đọc offline").

- [ ] **Step 4: `src/features/offline/downloads.ts`**

```ts
// Tải về đọc offline (người đọc bấm): tải từng đợt chương vào kho trên máy và ghim lại. Tiến độ
// nằm ở store Zustand (không persist) nên đóng hộp thoại hay chuyển trang vẫn thấy; đóng tab thì
// dừng, bấm tải lại chỉ lấy phần còn thiếu.
import { toast } from 'sonner'
import { create } from 'zustand'
import { getChapterRange } from '@/features/chapters/api'
import { formatBytes } from '@/lib/format'
import { isNetworkError } from '@/lib/network'
import { OfflineStorageFullError, pinChapters, saveChapters, walkSaved } from './store'

/** Số chương mỗi đợt tải */
export const DOWNLOAD_BATCH = 20

export type Download = {
  status: 'running' | 'done' | 'cancelled' | 'failed'
  /** Số chương trong khoảng đã có trên máy (kể cả chương có sẵn trước lượt tải) */
  done: number
  total: number
  /** Dung lượng vừa tải */
  bytes: number
  error?: string
}

export const useDownloads = create<{ bySlug: Record<string, Download> }>(() => ({ bySlug: {} }))

const update = (slug: string, download: Download) =>
  useDownloads.setState((s) => ({ bySlug: { ...s.bySlug, [slug]: download } }))

const controllers = new Map<string, AbortController>()
const encoder = new TextEncoder()

export function cancelDownload(slug: string) {
  controllers.get(slug)?.abort()
}

type Request = {
  slug: string
  title: string
  /** Chương bắt đầu (chương đang đọc, chỗ đọc dở hoặc chương đầu) */
  from: number
  /** Số chương cần có trên máy tính từ `from` */
  total: number
  /** Sau mỗi đợt và khi xong (làm mới danh sách "Đã lưu") */
  onChange?: () => void
}

/**
 * Tải `total` chương từ chương `from`: đoạn đầu đã có trên máy được ghim tại chỗ và tính vào số
 * chương; phần còn lại tải từng đợt DOWNLOAD_BATCH chương. Mỗi truyện một lượt tải cùng lúc.
 */
export async function downloadChapters({ slug, title, from, total, onChange }: Request) {
  if (controllers.has(slug)) return
  const controller = new AbortController()
  controllers.set(slug, controller)
  let done = 0
  let bytes = 0
  update(slug, { status: 'running', done, total, bytes })
  try {
    const { saved, missing } = await walkSaved(slug, from, total)
    await pinChapters(slug, saved)
    done = saved.length
    update(slug, { status: 'running', done, total, bytes })
    let next = missing
    while (next !== null && done < total && !controller.signal.aborted) {
      const chapters = await getChapterRange(slug, next, Math.min(DOWNLOAD_BATCH, total - done))
      if (chapters.length === 0) break
      await saveChapters(chapters, { pinned: true })
      done += chapters.length
      bytes += chapters.reduce((sum, c) => sum + encoder.encode(c.content).length, 0)
      next = chapters.at(-1)!.next?.number ?? null
      update(slug, { status: 'running', done, total, bytes })
      onChange?.()
    }
    if (controller.signal.aborted) {
      update(slug, { status: 'cancelled', done, total, bytes })
    } else {
      update(slug, { status: 'done', done, total, bytes })
      toast.success(`Đã tải ${done} chương "${title}"`, {
        description: `${formatBytes(bytes)} · đọc được cả khi không có mạng`,
      })
    }
  } catch (error) {
    const message =
      error instanceof OfflineStorageFullError
        ? `Bộ nhớ máy đầy, đã tải được ${done} chương.`
        : isNetworkError(error)
          ? `Mất mạng, đã tải được ${done} chương. Có mạng lại thì bấm tải tiếp.`
          : `Không tải được, đã tải được ${done} chương. Thử lại sau.`
    update(slug, { status: 'failed', done, total, bytes, error: message })
    toast.error(message)
  } finally {
    controllers.delete(slug)
    onChange?.()
  }
}
```

- [ ] **Step 5: `src/features/offline/components/DownloadButton.tsx`**

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { Download as DownloadIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useChapterCountFrom } from '@/features/chapters/hooks'
import { useOnline } from '@/hooks/useOnline'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cancelDownload, type Download, downloadChapters, useDownloads } from '../downloads'
import { offlineKeys, useSavedChapters } from '../hooks'

type Props = {
  slug: string
  title: string
  /** Tải từ chương này */
  from: number
  className?: string
}

/** Nút "Tải về đọc offline" + hộp thoại chọn số chương, xem tiến độ, hủy */
export function DownloadButton({ slug, title, from, className }: Props) {
  const online = useOnline()
  const [open, setOpen] = useState(false)
  const download = useDownloads((s) => s.bySlug[slug])
  const running = download?.status === 'running'

  return (
    <>
      <Button
        variant="outline"
        className={cn('rounded-full', className)}
        disabled={!online && !running}
        onClick={() => setOpen(true)}
      >
        <DownloadIcon />
        {running ? `Đang tải ${download.done}/${download.total}` : 'Tải về đọc offline'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tải về đọc offline</DialogTitle>
            <DialogDescription>
              Tải từ chương {from}. Chương tải về được giữ trên máy tới khi bạn xóa trong Tủ truyện,
              mục Đã lưu.
            </DialogDescription>
          </DialogHeader>
          {open && <DownloadPanel slug={slug} title={title} from={from} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function DownloadPanel({ slug, title, from }: Omit<Props, 'className'>) {
  const queryClient = useQueryClient()
  const download = useDownloads((s) => s.bySlug[slug])
  const remaining = useChapterCountFrom(slug, from)
  const saved = useSavedChapters(slug)
  const have = saved.data?.filter((c) => c.number >= from).length ?? 0

  if (download?.status === 'running') {
    const percent = download.total ? Math.round((download.done / download.total) * 100) : 0
    return (
      <div className="space-y-4">
        <div
          role="progressbar"
          aria-label="Tiến độ tải"
          aria-valuemin={0}
          aria-valuemax={download.total}
          aria-valuenow={download.done}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Đang tải {download.done}/{download.total} chương. Có thể đóng hộp thoại, việc tải vẫn
          tiếp tục.
        </p>
        <Button variant="outline" className="rounded-full" onClick={() => cancelDownload(slug)}>
          Hủy tải
        </Button>
      </div>
    )
  }

  const start = (total: number) =>
    void downloadChapters({
      slug,
      title,
      from,
      total,
      onChange: () => void queryClient.invalidateQueries({ queryKey: offlineKeys.all }),
    })
  const total = remaining.data

  return (
    <div className="space-y-4">
      {download && <DownloadResult download={download} />}
      {have > 0 && (
        <p className="text-sm text-muted-foreground">
          Đã có {have} chương từ chương {from} trên máy.
        </p>
      )}
      {remaining.isError ? (
        <p className="text-sm text-destructive">Không lấy được số chương. Thử lại sau.</p>
      ) : total === undefined ? (
        <div className="h-10 animate-pulse rounded-full bg-muted" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">Không còn chương nào để tải.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {[20, 50]
            .filter((n) => n < total)
            .map((n) => (
              <Button key={n} variant="outline" className="rounded-full" onClick={() => start(n)}>
                {n} chương
              </Button>
            ))}
          <Button className="rounded-full" onClick={() => start(total)}>
            Toàn bộ {total} chương
          </Button>
        </div>
      )}
    </div>
  )
}

function DownloadResult({ download }: { download: Download }) {
  const text =
    download.status === 'done'
      ? `Đã tải ${download.done} chương · ${formatBytes(download.bytes)}.`
      : download.status === 'cancelled'
        ? `Đã hủy, giữ ${download.done} chương đã tải.`
        : download.error
  return (
    <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
      {text}
    </p>
  )
}
```

- [ ] **Step 6: Đặt nút ở trang truyện và mục lục trang đọc**

`src/features/stories/detail/StoryHero.tsx`: thêm `import { DownloadButton } from '@/features/offline/components/DownloadButton'`; trong nhóm nút `<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">`, sau khối `{isOwner ? (...) : (<FollowButton ... />)}` thêm `<StoryDownloadButton story={story} />`; thêm cuối file:

```tsx
/** Tải từ chỗ đọc dở, chưa đọc thì từ chương đầu */
function StoryDownloadButton({ story }: { story: Story }) {
  const { data: progress } = useStoryProgress(story.slug)
  if (story.firstChapterNumber === null) return null
  return (
    <DownloadButton
      slug={story.slug}
      title={story.title}
      from={progress?.chapter ?? story.firstChapterNumber}
      className={onDarkOutline}
    />
  )
}
```

`src/features/reader/components/ReaderChapterIndex.tsx`: `Props` thêm `/** Tên truyện (thông báo tải về) */ title: string`, hàm nhận `title`; thêm `import { DownloadButton } from '@/features/offline/components/DownloadButton'`; trong hàng đầu (`<div className="flex flex-wrap items-center gap-3 border-b px-4 pb-4">`), sau `<JumpToChapter ... />` thêm:

```tsx
        <DownloadButton slug={slug} title={title} from={current} className="h-9" />
```

`src/features/reader/components/ReaderToolbar.tsx`: `<ReaderChapterIndex` thêm prop `title={story.title}`.

- [ ] **Step 7: Chạy test**

Run: `npx vitest run src/features/offline src/features/reader src/features/stories && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/components/ui/sonner.tsx src/app/providers.tsx src/features/offline src/features/stories/detail/StoryHero.tsx src/features/reader/components
git add package.json package-lock.json src/components/ui/sonner.tsx src/app/providers.tsx src/features/offline src/features/stories/detail/StoryHero.tsx src/features/reader/components
git commit -F - <<'EOF'
Đọc offline: nút "Tải về đọc offline"

Ở trang truyện và mục lục trang đọc: chọn 20, 50 hoặc toàn bộ chương còn lại,
tải từng đợt 20 chương, có tiến độ và nút hủy; chương tải về được ghim (không
tự xóa), bấm tải lại chỉ lấy phần còn thiếu. Thêm sonner cho thông báo nổi.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Đồng bộ lịch sử đọc khi có mạng lại

**Files:**
- Create: `src/features/library/pendingProgress.ts`
- Create: `src/features/library/components/OfflineSync.tsx`
- Create: `src/features/library/offline-progress.test.tsx`
- Modify: `src/features/library/api.remote.ts`, `src/features/library/api.mock.ts`, `src/features/library/api.ts`
- Modify: `src/features/library/hooks.ts`
- Modify: `src/app/providers.tsx`
- Test: `src/features/library/api.remote.test.ts`

**Interfaces:**
- Consumes: `isNetworkError`; `ProgressInput`, `ReadingProgress`.
- Produces:
  - `pendingProgress.ts`: `type PendingProgress = ProgressInput & { readAt: string }`; `queueProgress(userId, input): ReadingProgress`; `pendingProgress(userId): PendingProgress[]`; `dropPending(userId, slug, readAt?: string)`.
  - api: `syncPendingProgress(): Promise<number>` (số mục đã gửi; bản giả luôn `0`).
  - hook `usePendingProgressSync()`; component `OfflineSync`.

- [ ] **Step 1: Viết test hỏng (bản Supabase)**

`src/features/library/api.remote.test.ts`: sửa import thành

```ts
import {
  getLibrary,
  getLibraryUpdateCount,
  saveReadingProgress,
  syncPendingProgress,
} from './api.remote'
import { loadGuestHistory } from './guestHistory'
import { pendingProgress, queueProgress } from './pendingProgress'
```

thêm cuối file:

```ts
const offline = { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }

test('ghi chỗ đọc lúc mất mạng: vào hàng chờ, trả về như đã lưu', async () => {
  fake.userId = USER
  fake.respond = () => offline
  await expect(
    saveReadingProgress({ slug: 'mua-ha', chapter: 5, chapterTitle: 'Chương 5', progress: 0.4 }),
  ).resolves.toMatchObject({ slug: 'mua-ha', chapter: 5, progress: 0.4 })
  // Mở lại đúng chương đó (không kèm vị trí): giữ vị trí đang chờ, như RPC
  await expect(
    saveReadingProgress({ slug: 'mua-ha', chapter: 5, chapterTitle: 'Chương 5' }),
  ).resolves.toMatchObject({ progress: 0.4 })
  expect(pendingProgress(USER)).toMatchObject([{ slug: 'mua-ha', chapter: 5, progress: 0.4 }])
})

test('có mạng lại: gửi hàng chờ cũ trước, gửi được thì xóa', async () => {
  queueProgress(USER, { slug: 'a', chapter: 1, chapterTitle: 'Chương 1', progress: 0.2 })
  await new Promise((resolve) => setTimeout(resolve, 2))
  queueProgress(USER, { slug: 'b', chapter: 3, chapterTitle: 'Chương 3' })
  fake.userId = USER
  fake.respond = () => ok(historyRow(1, 0.2))

  await expect(syncPendingProgress()).resolves.toBe(2)
  expect(rpcCalls('save_reading_progress').map((calls) => calls[0][2])).toEqual([
    { p_slug: 'a', p_chapter: 1, p_chapter_title: 'Chương 1', p_progress: 0.2 },
    { p_slug: 'b', p_chapter: 3, p_chapter_title: 'Chương 3', p_progress: undefined },
  ])
  expect(pendingProgress(USER)).toEqual([])
})

test('gửi hàng chờ: vẫn mất mạng thì giữ; lỗi khác (truyện đã bị gỡ) thì bỏ mục đó', async () => {
  queueProgress(USER, { slug: 'a', chapter: 1, chapterTitle: 'Chương 1' })
  fake.userId = USER
  fake.respond = () => offline
  await expect(syncPendingProgress()).resolves.toBe(0)
  expect(pendingProgress(USER)).toHaveLength(1)

  fake.respond = () => ({ data: null, error: { code: 'P0001', message: 'not_found' } })
  await syncPendingProgress()
  expect(pendingProgress(USER)).toEqual([])
})

test('hàng chờ tách theo tài khoản: người khác đăng nhập không gửi hàng chờ của người trước', async () => {
  queueProgress('u-a', { slug: 'a', chapter: 1, chapterTitle: 'Chương 1' })
  fake.userId = 'u-b'
  await expect(syncPendingProgress()).resolves.toBe(0)
  expect(rpcCalls('save_reading_progress')).toEqual([])
  expect(pendingProgress('u-a')).toHaveLength(1)
})

test('ghi được lên máy chủ thì bỏ mục đang chờ (cũ hơn) của truyện đó', async () => {
  queueProgress(USER, { slug: 'mua-ha', chapter: 2, chapterTitle: 'Chương 2' })
  fake.userId = USER
  fake.respond = () => ok(historyRow(6, 0))
  await saveReadingProgress({ slug: 'mua-ha', chapter: 6, chapterTitle: 'Chương 6' })
  expect(pendingProgress(USER)).toEqual([])
})
```

- [ ] **Step 2: Viết test hỏng (tích hợp, bản giả)**

`src/features/library/offline-progress.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { getSavedChapter } from '@/features/offline/store'
import { READER_DEFAULTS, useReaderSettings } from '@/features/reader/useReaderSettings'
import { registerUser } from '@/test/helpers'
import { goOffline } from '@/test/offline'
import { renderApp } from '@/test/renderApp'
import { getStoryProgress } from './api'

const slug = 'truong-an-khong-tuyet'
const base = `/story/${slug}`

beforeEach(() => {
  localStorage.clear()
  useReaderSettings.setState(READER_DEFAULTS)
})

test('mất mạng vẫn ghi lịch sử đọc khi chuyển chương', async () => {
  await registerUser()
  const { user, router } = renderApp(`${base}/chapter-12`)
  await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })
  await expect.poll(() => getSavedChapter(slug, 13), { timeout: 3000 }).not.toBeNull()

  goOffline()
  await user.keyboard('{ArrowRight}')
  await expect.poll(() => router.state.location.pathname).toBe(`${base}/chapter-13`)
  await expect
    .poll(async () => (await getStoryProgress(slug))?.chapter, { timeout: 3000 })
    .toBe(13)
})
```

- [ ] **Step 3: Chạy test, xác nhận hỏng**

Run: `npx vitest run src/features/library`
Expected: FAIL (`syncPendingProgress`, `./pendingProgress` chưa có; test tích hợp dừng ở chương 12 vì mutation bị dừng khi offline).

- [ ] **Step 4: `src/features/library/pendingProgress.ts`**

```ts
// Chỗ đọc chưa gửi được lên máy chủ vì mất mạng (người đã đăng nhập, bản Supabase): lưu trên máy,
// có mạng lại thì OfflineSync gửi lên. Mỗi tài khoản một hàng chờ, mỗi truyện giữ lần ghi mới nhất.
import { readMock, writeMock } from '@/lib/mockStorage'
import type { ReadingProgress } from '@/types/library'
import type { ProgressInput } from './shared'

const KEY = 'reading-progress-pending'

export type PendingProgress = ProgressInput & { readAt: string }
type Queue = Record<string, Record<string, PendingProgress>>

function load(): Queue {
  const queue = readMock<unknown>(KEY, {})
  return queue && typeof queue === 'object' && !Array.isArray(queue) ? (queue as Queue) : {}
}

function save(queue: Queue) {
  const users = Object.entries(queue).filter(([, entries]) => Object.keys(entries).length > 0)
  writeMock(KEY, users.length ? Object.fromEntries(users) : null)
}

/**
 * Thêm lần ghi vào hàng chờ và trả về chỗ đọc như khi ghi thành công. Mở chương (progress bỏ
 * trống) mà vẫn là chương đang chờ thì giữ vị trí cũ, như RPC save_reading_progress.
 */
export function queueProgress(userId: string, input: ProgressInput): ReadingProgress {
  const queue = load()
  const mine = queue[userId] ?? {}
  const old = mine[input.slug]
  const progress = input.progress ?? (old?.chapter === input.chapter ? old.progress : undefined)
  const entry: PendingProgress = { ...input, progress, readAt: new Date().toISOString() }
  save({ ...queue, [userId]: { ...mine, [input.slug]: entry } })
  return {
    slug: input.slug,
    chapter: input.chapter,
    chapterTitle: input.chapterTitle,
    progress: Math.min(1, Math.max(0, progress ?? 0)),
    readAt: entry.readAt,
  }
}

/** Hàng chờ của một tài khoản, cũ nhất trước */
export function pendingProgress(userId: string): PendingProgress[] {
  return Object.values(load()[userId] ?? {}).sort((a, b) => a.readAt.localeCompare(b.readAt))
}

/** Bỏ mục của truyện `slug`; có `readAt` thì chỉ bỏ khi mục chưa bị thay bằng lần ghi mới hơn */
export function dropPending(userId: string, slug: string, readAt?: string) {
  const queue = load()
  const entry = queue[userId]?.[slug]
  if (!entry || (readAt !== undefined && entry.readAt !== readAt)) return
  const { [slug]: _dropped, ...rest } = queue[userId]
  save({ ...queue, [userId]: rest })
}
```

- [ ] **Step 5: Bản Supabase ghi hàng chờ và gửi lại**

`src/features/library/api.remote.ts`: thêm import `import { isNetworkError } from '@/lib/network'` và `import { dropPending, pendingProgress, queueProgress } from './pendingProgress'`. Thay `writeProgress` và thêm `syncPendingProgress`:

```ts
async function writeProgress(input: ProgressInput, previous: Promise<unknown>) {
  // Biết chủ lịch sử ngay lúc gọi, rồi mới chờ tới lượt: đăng xuất trong lúc chờ thì lần ghi này
  // không bị tính thành lịch sử của khách
  const userId = await getUserId()
  await previous
  if (!userId) return saveGuestProgress(input)
  try {
    await mergeGuestHistory()
    const row = unwrap(
      await db().rpc('save_reading_progress', {
        p_slug: input.slug,
        p_chapter: input.chapter,
        p_chapter_title: input.chapterTitle,
        // Bỏ trống thì RPC nhận null: giữ vị trí cũ nếu vẫn chương đó
        p_progress: input.progress,
      }),
      rpcError,
    )
    // Lần ghi này mới hơn mục đang chờ (nếu có) của truyện
    dropPending(userId, input.slug)
    return toProgress(input.slug, row)
  } catch (error) {
    // Mất mạng: giữ trên máy, có mạng lại thì syncPendingProgress gửi lên
    if (!isNetworkError(error)) throw error
    return queueProgress(userId, input)
  }
}

/**
 * Gửi các chỗ đọc ghi lúc mất mạng của người đang đăng nhập, cũ trước mới sau; trả số mục đã gửi.
 * Chạy nối đuôi các lần ghi khác (lastSave) để không ghi đè lần ghi mới hơn.
 */
export function syncPendingProgress(): Promise<number> {
  const sync = sendPending(lastSave)
  lastSave = sync.catch(() => undefined)
  return sync
}

async function sendPending(previous: Promise<unknown>) {
  const userId = await getUserId()
  await previous
  if (!userId) return 0
  let sent = 0
  for (const entry of pendingProgress(userId)) {
    const { error } = await db().rpc('save_reading_progress', {
      p_slug: entry.slug,
      p_chapter: entry.chapter,
      p_chapter_title: entry.chapterTitle,
      p_progress: entry.progress,
    })
    // Mất mạng hay phiên hết hạn: để lần sau. Lỗi khác (truyện đã bị gỡ...) gửi lại cũng lỗi: bỏ
    if (error && (isNetworkError(error) || businessCode(error) === 'unauthenticated')) break
    dropPending(userId, entry.slug, entry.readAt)
    if (!error) sent++
  }
  return sent
}
```

`historyOwner` vẫn dùng ở các hàm khác, giữ nguyên.

`src/features/library/api.mock.ts`, thêm cuối file:

```ts
/** Bản giả ghi thẳng vào localStorage nên không có gì chờ gửi */
export async function syncPendingProgress(): Promise<number> {
  return 0
}
```

`src/features/library/api.ts`: thêm `syncPendingProgress,` vào danh sách export.

- [ ] **Step 6: Hook, mutation chạy khi offline, OfflineSync**

`src/features/library/hooks.ts`:
- thêm `import { useEffect } from 'react'`;
- trong `useSaveReadingProgress`, `useMutation({` thêm dòng đầu:

```ts
    // Mặc định mutation bị dừng khi offline: phải chạy để tới được hàng chờ (bản Supabase)
    networkMode: 'always',
```

- thêm cuối file:

```ts
/** Khi mở app, đổi tài khoản và khi có mạng lại: gửi các chỗ đọc ghi lúc offline */
export function usePendingProgressSync() {
  const { user } = useLibraryUser()
  const queryClient = useQueryClient()
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    const sync = () =>
      void api.syncPendingProgress().then(
        (sent) => {
          if (sent > 0) void queryClient.invalidateQueries({ queryKey: libraryKeys.all(userId) })
        },
        () => {},
      )
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [queryClient, userId])
}
```

`src/features/library/components/OfflineSync.tsx`:

```tsx
import { usePendingProgressSync } from '../hooks'

/** Gắn một lần trong Providers: gửi lịch sử đọc ghi lúc mất mạng khi có mạng lại */
export function OfflineSync() {
  usePendingProgressSync()
  return null
}
```

`src/app/providers.tsx`: thêm `import { OfflineSync } from '@/features/library/components/OfflineSync'` và `<OfflineSync />` ngay sau `<AuthSync />`.

- [ ] **Step 7: Chạy test**

Run: `npx vitest run src/features/library && npm test && npm run typecheck && npm run lint`
Expected: PASS hết (kể cả hai test cũ "ghi chỗ đọc: lần sau chỉ gửi khi lần trước xong", "lần trước lỗi thì lần sau vẫn chạy").

- [ ] **Step 8: Commit**

```bash
npx prettier --write src/features/library src/app/providers.tsx
git add src/features/library src/app/providers.tsx
git commit -F - <<'EOF'
Tủ truyện: lịch sử đọc lúc mất mạng được đồng bộ khi có mạng lại

Bản Supabase ghi chỗ đọc lỗi mạng vào hàng chờ trên máy (tách theo tài khoản,
mỗi truyện giữ lần mới nhất), OfflineSync gửi lên khi mở app và khi có mạng
lại, nối đuôi các lần ghi khác. Mutation ghi lịch sử chạy cả khi offline.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: PWA — manifest, icon, service worker, cài ứng dụng, cập nhật phiên bản

**Files:**
- Modify: `public/favicon.svg` (thay logo Vite bằng icon của web)
- Create: `pwa-assets.config.ts`, các file sinh ra trong `public/` (`favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`)
- Create: `pwa.config.ts`, `pwa.config.test.ts`
- Modify: `vite.config.ts`, `tsconfig.node.json`, `package.json`, `index.html`, `vercel.json`, `src/vite-env.d.ts`, `src/main.tsx`
- Create: `src/app/PwaUpdater.tsx`
- Create: `src/hooks/useInstallPrompt.ts`, `src/components/common/InstallAppButton.tsx`, `src/components/common/InstallAppButton.test.tsx`
- Modify: `src/components/common/Footer.tsx`, `src/features/auth/components/UserMenu.tsx`

**Interfaces:**
- Consumes: `toast` (sonner, Task 7); `SITE_NAME`, `SITE_TAGLINE`.
- Produces: `offlineChunkFiles(chunks)`, `pwa()` (mảng plugin Vite); `useInstallPrompt(): { available: boolean; install: () => Promise<void> }`; `InstallAppButton`; `PwaUpdater`.

- [ ] **Step 1: Cài thư viện**

Run: `npm install -D vite-plugin-pwa@^1.3 @vite-pwa/assets-generator@^1 && npm ls workbox-window workbox-build`
Expected: có cả `workbox-window` và `workbox-build` (peer của vite-plugin-pwa). Nếu thiếu `workbox-window`: `npm install -D workbox-window@^7`.

- [ ] **Step 2: Icon mới và sinh PNG**

Ghi đè `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1a0f1d"/>
  <path d="M256 170c-38-26-88-34-136-26v206c48-8 98 0 136 26 38-26 88-34 136-26V144c-48-8-98 0-136 26z" fill="none" stroke="#d9a68f" stroke-width="18" stroke-linejoin="round"/>
  <path d="M256 170v206" stroke="#d9a68f" stroke-width="18"/>
  <path d="M308 150v92l22-16 22 16v-98" fill="#ff3d8b"/>
</svg>
```

Tạo `pwa-assets.config.ts`:

```ts
import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Icon ứng dụng (PWA) sinh từ public/favicon.svg: `npm run generate-pwa-assets` rồi commit các file
// trong public/. Icon maskable (Android) và apple-touch-icon lấy nền tím mận của theme tối
const resizeOptions = { background: '#1a0f1d' }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions },
    apple: { ...preset.apple, resizeOptions },
  },
  images: ['public/favicon.svg'],
})
```

`package.json`, `scripts` thêm `"generate-pwa-assets": "pwa-assets-generator"`.

Run: `npm run generate-pwa-assets && ls public`
Expected: có `favicon.ico`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`. Mở `public/pwa-512x512.png` và `public/maskable-icon-512x512.png` bằng Read để xem: sách mở nằm giữa, dải hồng không bị cắt; nếu lệch thì chỉnh tọa độ trong SVG rồi sinh lại.

- [ ] **Step 3: Viết test hỏng cho việc chọn chunk precache**

`pwa.config.test.ts`:

```ts
import { expect, test } from 'vitest'
import { offlineChunkFiles } from './pwa.config.ts'

const chunk = (fileName: string, facadeModuleId: string | null, imports: string[] = [], isEntry = false) => ({
  fileName,
  facadeModuleId,
  imports,
  isEntry,
})

test('giữ chunk vào app và các trang thường cùng chunk chúng import; bỏ khu Quản trị và Sáng tác', () => {
  const files = offlineChunkFiles([
    chunk('assets/index.js', '/app/index.html', ['assets/vendor.js'], true),
    chunk('assets/vendor.js', null),
    chunk('assets/ChapterReaderPage.js', '/app/src/pages/ChapterReaderPage.tsx', ['assets/reader.js']),
    chunk('assets/reader.js', null),
    chunk('assets/AdminDashboardPage.js', '/app/src/pages/admin/AdminDashboardPage.tsx', ['assets/antd.js']),
    chunk('assets/antd.js', null),
    chunk('assets/ChapterEditorPage.js', '/app/src/pages/studio/ChapterEditorPage.tsx', ['assets/tiptap.js', 'assets/vendor.js']),
    chunk('assets/tiptap.js', null),
  ])
  expect([...files].sort()).toEqual([
    'assets/ChapterReaderPage.js',
    'assets/index.js',
    'assets/reader.js',
    'assets/vendor.js',
  ])
})
```

Run: `npx vitest run pwa.config.test.ts`
Expected: FAIL — không tìm thấy `./pwa.config.ts`.

- [ ] **Step 4: `pwa.config.ts`**

```ts
// Cấu hình PWA (vite-plugin-pwa): manifest, service worker Workbox. Service worker chỉ lo file tĩnh;
// chương đọc offline nằm trong IndexedDB do app quản lý (src/features/offline).
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { SITE_NAME, SITE_TAGLINE } from './src/config/site.ts'

type Chunk = {
  fileName: string
  imports: string[]
  isEntry: boolean
  facadeModuleId: string | null
}

/** Trang chỉ dùng khi có mạng: khu Quản trị (Ant Design, biểu đồ) và Sáng tác (trình soạn Tiptap) */
const ONLINE_ONLY = /\/src\/pages\/(admin|studio)\//

/** File JS cần để mở app offline: chunk vào app, các trang còn lại và mọi chunk chúng import tĩnh */
export function offlineChunkFiles(chunks: Chunk[]): Set<string> {
  const byFile = new Map(chunks.map((c) => [c.fileName, c]))
  const files = new Set<string>()
  const visit = (file: string) => {
    const chunk = byFile.get(file)
    if (!chunk || files.has(file)) return
    files.add(file)
    chunk.imports.forEach(visit)
  }
  for (const c of chunks) {
    const id = c.facadeModuleId ?? ''
    if (c.isEntry || (id.includes('/src/pages/') && !ONLINE_ONLY.test(id))) visit(c.fileName)
  }
  return files
}

/** Ghi lại danh sách chunk khi build để lọc danh sách precache của Workbox */
function offlinePrecache() {
  let files = new Set<string>()
  const plugin: Plugin = {
    name: 'offline-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      files = offlineChunkFiles(
        Object.values(bundle).flatMap((output) => (output.type === 'chunk' ? [output] : [])),
      )
    },
  }
  const transform = async <T extends { url: string }>(entries: T[]) => ({
    manifest: entries.filter((e) => !e.url.endsWith('.js') || files.has(e.url)),
    warnings: [] as string[],
  })
  return { plugin, transform }
}

export function pwa() {
  const precache = offlinePrecache()
  return [
    precache.plugin,
    VitePWA({
      // Có bản mới thì hỏi (src/app/PwaUpdater.tsx), không tự tải lại trang khi đang đọc
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: SITE_NAME,
        short_name: SITE_NAME,
        description: SITE_TAGLINE,
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1a0f1d',
        theme_color: '#1a0f1d',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Font chỉ cần bộ ký tự Latin và tiếng Việt
        globIgnores: ['**/*-cyrillic*', '**/*-greek*'],
        manifestTransforms: [precache.transform],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Ảnh bìa trên Supabase Storage: truyện đã lưu vẫn có bìa khi offline
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'story-covers',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Tắt service worker khi chạy dev (vướng HMR) và test
      devOptions: { enabled: false },
    }),
  ]
}
```

`tsconfig.node.json`: `"include"` thành `["vite.config.ts", "pwa.config.ts", "pwa.config.test.ts", "pwa-assets.config.ts"]`.

`vite.config.ts`: thêm `import { pwa } from './pwa.config.ts'`; `plugins: [react(), tailwindcss(), ...pwa()],`.

Run: `npx vitest run pwa.config.test.ts && npm run typecheck`
Expected: PASS. Nếu tsc báo kiểu `manifestTransforms` không khớp, đổi `transform` thành kiểu `ManifestTransform` import từ `workbox-build` (`import type { ManifestTransform } from 'workbox-build'`).

- [ ] **Step 5: Đăng ký service worker và thông báo phiên bản mới**

`src/vite-env.d.ts`, thêm dòng thứ hai: `/// <reference types="vite-plugin-pwa/react" />`.

`src/app/PwaUpdater.tsx`:

```tsx
// Đăng ký service worker; có bản mới thì hỏi trước khi tải lại (tự tải lại khi đang đọc sẽ mất chỗ
// đang đọc). Không bấm thì lần mở app sau dùng bản mới. Gắn ở main.tsx (test không chạy file này).
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    toast('Có phiên bản mới', {
      description: 'Cập nhật để dùng bản mới nhất của web.',
      duration: Infinity,
      action: { label: 'Cập nhật', onClick: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
```

`src/main.tsx`: thêm `import { PwaUpdater } from '@/app/PwaUpdater'`; trong `<Providers>` thêm `<PwaUpdater />` sau `<RouterProvider router={router} />`.

- [ ] **Step 6: Viết test hỏng cho nút "Cài ứng dụng"**

`src/components/common/InstallAppButton.test.tsx`:

```tsx
import { act, screen } from '@testing-library/react'
import { renderApp } from '@/test/renderApp'

test('trình duyệt cho cài thì hiện nút; bấm thì mở hộp cài của trình duyệt', async () => {
  const { user } = renderApp('/')
  await screen.findByRole('contentinfo', undefined, { timeout: 3000 })
  expect(screen.queryByRole('button', { name: 'Cài ứng dụng' })).toBeNull()

  const prompt = vi.fn(async () => {})
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  expect(event.defaultPrevented).toBe(true)

  await user.click(await screen.findByRole('button', { name: 'Cài ứng dụng' }))
  expect(prompt).toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Cài ứng dụng' })).toBeNull()
})
```

Run: `npx vitest run src/components/common/InstallAppButton.test.tsx`
Expected: FAIL (không có nút).

- [ ] **Step 7: `useInstallPrompt` và `InstallAppButton`**

`src/hooks/useInstallPrompt.ts`:

```ts
// Nút "Cài ứng dụng": Chrome, Edge, Android phát beforeinstallprompt khi web cài được (có manifest,
// service worker). Giữ sự kiện để người đọc tự bấm cài; iOS không có sự kiện này (tự "Thêm vào màn
// hình chính"), đã cài rồi thì trình duyệt cũng không phát nữa.
import { useSyncExternalStore } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

window.addEventListener('beforeinstallprompt', (event) => {
  // Không để trình duyệt tự hiện thanh gợi ý cài: web có nút riêng
  event.preventDefault()
  deferred = event as BeforeInstallPromptEvent
  notify()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useInstallPrompt() {
  const available = useSyncExternalStore(subscribe, () => deferred !== null, () => false)
  const install = async () => {
    const event = deferred
    if (!event) return
    // Mỗi sự kiện chỉ gọi prompt() được một lần
    deferred = null
    notify()
    await event.prompt()
  }
  return { available, install }
}
```

`src/components/common/InstallAppButton.tsx`:

```tsx
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cn } from '@/lib/utils'

/** Nút cài web thành ứng dụng; chỉ hiện khi trình duyệt cho cài */
export function InstallAppButton({ className }: { className?: string }) {
  const { available, install } = useInstallPrompt()
  if (!available) return null
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('rounded-full', className)}
      onClick={() => void install()}
    >
      <Download />
      Cài ứng dụng
    </Button>
  )
}
```

`src/components/common/Footer.tsx`: thêm `import { InstallAppButton } from './InstallAppButton'`; sau đoạn `<p className="mt-3 text-sm leading-relaxed text-muted-foreground">{SITE_TAGLINE}</p>` thêm `<InstallAppButton className="mt-4" />`.

`src/features/auth/components/UserMenu.tsx`: thêm `Download` vào import từ `lucide-react`, `import { useInstallPrompt } from '@/hooks/useInstallPrompt'`; trong `UserMenu` thêm `const { available: installable, install } = useInstallPrompt()`; sau mục "Tài khoản" thêm:

```tsx
        {installable && (
          <DropdownMenuItem onSelect={() => void install()}>
            <Download />
            Cài ứng dụng
          </DropdownMenuItem>
        )}
```

- [ ] **Step 8: `index.html` và `vercel.json`**

`index.html`: thay dòng `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` bằng:

```html
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
    <meta name="theme-color" content="#1a0f1d" />
```

`vercel.json`, mảng `headers` thêm (sau mục `/assets/(.*)`):

```json
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
    }
```

- [ ] **Step 9: Chạy test và build, kiểm danh sách precache**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: test PASS; build in dòng `PWA v1.x ... precache N entries (... KiB)`.

Run: `grep -o 'ChapterReaderPage-[A-Za-z0-9_-]*\.js' dist/sw.js | head -1; grep -c 'AdminDashboardPage\|ChapterFields\|cyrillic\|greek' dist/sw.js; grep -o 'vietnamese[^"]*woff2' dist/sw.js | head -3; ls dist/manifest.webmanifest`
Expected: có tên chunk `ChapterReaderPage-…js`; số đếm dòng thứ hai là `0`; có font `vietnamese`; có `dist/manifest.webmanifest`. Nếu `ChapterReaderPage` không có trong `sw.js`, `generateBundle` chạy sau khi Workbox dựng danh sách: chuyển việc tính `files` sang hook `writeBundle` và kiểm lại.

- [ ] **Step 10: Commit**

```bash
npx prettier --write pwa.config.ts pwa.config.test.ts pwa-assets.config.ts vite.config.ts tsconfig.node.json index.html vercel.json src/vite-env.d.ts src/main.tsx src/app/PwaUpdater.tsx src/hooks/useInstallPrompt.ts src/components/common src/features/auth/components/UserMenu.tsx
git add package.json package-lock.json public pwa.config.ts pwa.config.test.ts pwa-assets.config.ts vite.config.ts tsconfig.node.json index.html vercel.json src/vite-env.d.ts src/main.tsx src/app/PwaUpdater.tsx src/hooks/useInstallPrompt.ts src/components/common src/features/auth/components/UserMenu.tsx
git commit -F - <<'EOF'
PWA: cài web thành ứng dụng, chạy khung app khi offline

vite-plugin-pwa (Workbox): manifest, icon mới sinh từ favicon.svg, precache
HTML/JS/CSS và font Latin/tiếng Việt (bỏ chunk khu Quản trị, Sáng tác), ảnh bìa
cache khi xem. Có bản mới thì hỏi trước khi cập nhật; nút "Cài ứng dụng" ở
footer và menu tài khoản khi trình duyệt cho cài.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Tài liệu và kiểm tra thực tế

**Files:**
- Modify: `CLAUDE.md`
- Modify: `documents/plan-pwa-doc-offline.md` (trạng thái), `documents/plan-bo-cuc-va-cong-nghe.md` (bước 5c)

- [ ] **Step 1: Cập nhật CLAUDE.md**

Trong mục **Kiến trúc**, thêm gạch đầu dòng sau mục "Trang đọc":

```markdown
- **Đọc offline & PWA** (`features/offline`, plan `documents/plan-pwa-doc-offline.md`):
  - `vite-plugin-pwa` cấu hình ở `pwa.config.ts` (precache bỏ chunk khu Quản trị/Sáng tác và font ngoài Latin/tiếng Việt; tắt ở dev và test). Icon sinh từ `public/favicon.svg` bằng `npm run generate-pwa-assets`. Có bản mới thì hỏi (`src/app/PwaUpdater.tsx`).
  - Chương đọc qua `readChapter` → kho IndexedDB `features/offline/store.ts` (có bản lưu thì trả ngay và làm mới ở nền; mất mạng mà chưa lưu → `ChapterNotSavedError`). Tải trước 5 chương (`usePrefetchChapters`), tải về chủ động thì ghim (`downloads.ts`), tối đa 300 chương không ghim. Tab `/library?tab=saved`.
  - Query/mutation cần chạy khi offline đặt `networkMode: 'always'` (chương, kho, phiên đăng nhập, ghi lịch sử).
  - Lịch sử đọc lỗi mạng (bản Supabase) vào hàng chờ `features/library/pendingProgress.ts`, `OfflineSync` gửi khi có mạng lại.
  - Thông báo nổi dùng `toast` của `sonner`.
```

Trong mục **Test tích hợp**, thêm:

```markdown
  - Đọc offline: `fake-indexeddb` nạp trong `src/test/setup.ts` (mỗi test một kho trống, hết test tự có mạng lại). Giả mất mạng bằng `goOffline()`, chương giả bằng `fakeChapter()` ở `src/test/offline.ts`.
```

- [ ] **Step 2: Kiểm tra toàn bộ**

Run: `npm test && npm run typecheck && npm run lint && npm run format:check && npm run build`
Expected: tất cả qua.

- [ ] **Step 3: Kiểm tay bằng Playwright trên bản build**

Run (nền): `npm run preview`

Dùng Playwright MCP (ảnh chụp lưu trong `.playwright-mcp/`):
1. Mở `http://localhost:3000/story/truong-an-khong-tuyet/chapter-12` (bản preview dùng dữ liệu giả nếu `.env` không có Supabase), chờ tải xong, đợi 2 giây cho tải trước.
2. DevTools qua `browser_evaluate`: `navigator.serviceWorker.controller !== null` (tải lại một lần nếu `false` ở lần đầu), `await caches.keys()` có cache `workbox-precache…`.
3. Bật offline (`browser_run_code_unsafe`: `await page.context().setOffline(true)`), mở `/story/truong-an-khong-tuyet/chapter-15` → đọc được; mở `/library?tab=saved` → thấy truyện; mở `/studio` → màn hình "Bạn đang offline"; mở `/` → dải "Bạn đang offline."
4. Chụp màn hình trang đọc offline, tab "Đã lưu", hộp thoại "Tải về đọc offline" ở 375px, 768px, 1440px, cả theme tối và sáng.
5. Kiểm manifest: `fetch('/manifest.webmanifest').then(r => r.json())` có đủ icon; mở `/pwa-512x512.png` xem icon.

Expected: các trang trên hoạt động như mô tả, không vỡ bố cục ở 3 kích thước, cả hai theme.

- [ ] **Step 4: Đánh dấu tiến độ**

`documents/plan-pwa-doc-offline.md`: dòng `**Trạng thái:** Đã duyệt thiết kế, chưa làm.` thành `**Trạng thái:** ✅ Xong (DD/MM/YYYY).` với ngày làm xong.
`documents/plan-bo-cuc-va-cong-nghe.md`: bước 5c đổi `(đã duyệt thiết kế 29/09/2026, chưa làm; ...)` thành `✅ (DD/MM/YYYY, chi tiết ở plan-pwa-doc-offline.md)` với ngày làm xong.

- [ ] **Step 5: Commit**

```bash
npx prettier --write CLAUDE.md documents
git add CLAUDE.md documents
git commit -F - <<'EOF'
Tài liệu: PWA và đọc offline

Ghi cách hoạt động của kho chương offline, networkMode 'always', hàng chờ lịch
sử đọc và tiện ích test vào CLAUDE.md; đánh dấu xong bước 5c.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
