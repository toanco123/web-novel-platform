---
name: integration-test
description: Dùng khi viết, sửa hoặc gỡ lỗi test vitest của dự án (test luồng *-flow.test.tsx, api.test.ts, api.remote.test.ts, test trang hay hàm Vercel), kể cả khi test chập chờn, quá thời gian hoặc không tìm thấy phần tử.
---

# Viết test (vitest + Testing Library)

Test luôn chạy trên dữ liệu giả (`VITE_USE_MOCK=true` trong `vite.config.ts`), không gọi Supabase thật. Test tích hợp dựng cả app (router, TanStack Query) rồi thao tác như người dùng.

## Loại test và chỗ đặt file

| Loại             | File                                                                              | Cách viết                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Luồng giao diện  | `src/features/<x>/<x>-flow.test.tsx`; luồng đi qua nhiều khu thì để ở `src/test/` | `renderApp(path)` (`src/test/renderApp.tsx`): QueryClient và memory router mới cho mỗi lần gọi, trả về `router` và `user` của user-event                                             |
| Api bản giả      | `src/features/<x>/api.test.ts`                                                    | Gọi thẳng hàm của `./api` sau khi tạo người dùng bằng helper                                                                                                                         |
| Api bản Supabase | `src/features/<x>/api.remote.test.ts`                                             | `vi.mock('@/lib/supabase', () => ({ supabase: null, db: () => fake }))`, kiểm tra đúng bảng/RPC, chỉ gửi cột được cấp quyền, map mã lỗi. Mẫu: `features/feedback/api.remote.test.ts` |
| Hàm Vercel       | `api/_lib/*.test.ts`                                                              | Chạy bằng `npx vitest run api`                                                                                                                                                       |

Tên test viết bằng tiếng Việt, mô tả hành vi.

## Khung chuẩn

```tsx
import { screen } from '@testing-library/react'
import { publishStory, registerUser, signInAs } from '@/test/helpers'
import { renderApp } from '@/test/renderApp'

const slow = { timeout: 3000 }
beforeEach(() => localStorage.clear())

test('quản trị viên tìm người dùng theo tên không dấu', async () => {
  await registerUser('Linh', 'linh@gmail.com')
  await publishStory('Mùa Hạ Năm Ấy', 2)
  signInAs('demo')
  const { router, user } = renderApp('/admin/users')
  expect(await screen.findByText('linh@gmail.com', {}, slow)).toBeInTheDocument()
  await user.type(screen.getByRole('searchbox', { name: 'Tìm người dùng' }), 'linh{Enter}')
  await expect.poll(() => router.state.location.search, slow).toBe('?q=linh')
  await expect.poll(() => screen.queryByText('demo@webtruyen.vn'), slow).toBeNull()
})
```

## Dữ liệu và đăng nhập (`src/test/helpers.ts`)

- `registerUser(name?, email?)`: tạo người dùng thường, phiên chuyển sang người đó, trả về id.
- `signInAs(id)` / `signOut()`: đổi phiên trong localStorage. `signInAs('demo')` là tài khoản demo, cũng là quản trị viên.
- `draftStory(title?, chapters?)`: truyện nháp có `chapters` chương đã xuất bản. `pendingStory`: nháp đã gửi duyệt. `publishStory`: truyện công khai (người thường thì tự gửi duyệt và được duyệt luôn). `approveAsAdmin(storyId)`.
- Dựng dữ liệu bằng helper hoặc api; chỉ thao tác giao diện ở phần đang kiểm tra.
- Mọi file test dùng dữ liệu giả có `beforeEach(() => localStorage.clear())`.

## Bẫy thường gặp

- **Đổi người dùng giữa test:** phiên nằm trong cache (`staleTime: Infinity`). Sau `signInAs`/`signOut` mà cần giao diện theo người mới thì `cleanup()` rồi `renderApp(...)` lại.
- **Chờ:** api giả có độ trễ, nên `findBy*` truyền `slow` (`{ timeout: 3000 }` trở lên). Điều hướng tới trang lazy-load, đổi URL, hay dữ liệu ghi sau cập nhật lạc quan thì dùng `await expect.poll(() => ..., slow)`, không kiểm tra ngay sau `user.click`. `testTimeout` chung là 10 giây; luồng dài thì nâng riêng cho test đó (`}, 20_000)`).
- **Trình soạn chương (Tiptap):** gõ từng phím vào trình soạn bị mất ký tự trong jsdom, nên dùng `writeInEditor(user, editor, text)` (bấm rồi dán).
- **Ant Design:** trang có biểu đồ (`/admin`, thống kê) cần `vi.mock('@ant-design/plots', ...)` thay biểu đồ bằng thẻ rỗng, vì G2 cần canvas (mẫu ở đầu `features/admin/admin-flow.test.tsx`). Popconfirm: tìm theo chữ rồi `.closest('.ant-popover')`.
- **API jsdom thiếu:** `src/test/setup.ts` đã stub cho Radix, ProseMirror và `matchMedia`. Nghe truyện: `vi.stubGlobal` cho `speechSynthesis`. Cuộn liên tục: jsdom không có IntersectionObserver, nên bấm nút "Tải chương N". Tự động cuộn: giả `requestAnimationFrame`, `scrollTo` và `getBoundingClientRect` (xem `features/reader/autoscroll.test.tsx`).
- **Đọc offline:** `fake-indexeddb` đã nạp sẵn (mỗi test một kho trống, hết test tự có mạng lại). Giả mất mạng bằng `goOffline()`, chương giả bằng `fakeChapter(slug, number)` (`src/test/offline.ts`).

## Chạy

```bash
npx vitest run src/features/<x>/<x>-flow.test.tsx   # một file
npx vitest run -t "tên test"                         # theo tên
npm test                                             # cả bộ, trước khi commit
```
