---
name: parallel-delegation
description: Dùng khi một tính năng lớn có nhiều phần độc lập (nhiều trang admin, nhiều migration, test, tài liệu, kiểm tra giao diện) và cần chia việc song song hoặc giao việc nhẹ cho agent dùng model rẻ hơn (haiku, sonnet) để đẩy nhanh tiến độ và tiết kiệm chi phí.
---

# Làm song song và giao việc cho model rẻ hơn

Mục tiêu: bản thân (model chính) giữ phần cần phán đoán, giao phần cơ học hoặc chạy lâu cho agent nền. Chỉ giao khi việc độc lập và mô tả được trong vài câu; việc ngắn tự làm nhanh hơn.

## Chia theo mức khó

| Việc                                                                                      | Ai làm                          | Model       |
| ----------------------------------------------------------------------------------------- | ------------------------------- | ----------- |
| Thiết kế schema, SQL của RPC `security definer`, RLS, quyền, ca kiểm tra SQL              | Model chính                     | Model chính |
| Chạy toàn bộ `npm test`, typecheck, lint và tóm tắt lỗi                                   | Agent nền                       | `haiku`     |
| Viết test api/flow theo mẫu có sẵn từ spec rõ ràng                                        | Agent nền                       | `sonnet`    |
| Kiểm tra giao diện 375/768/1440px, hai theme bằng Playwright, chụp ảnh và báo lỗi         | Agent nền, chỉ đọc              | `sonnet`    |
| Cập nhật tài liệu (`documents/`, `thiet-ke-database.md`, CLAUDE.md) theo thay đổi đã xong | Agent nền                       | `haiku`     |
| Tìm nơi dùng một hàm/khóa trong repo                                                      | `Explore`                       | mặc định    |
| Rà lỗi logic, bảo mật của diff                                                            | Model chính hoặc `/code-review` | Model chính |

Phần nào quyết định đúng/sai của dữ liệu thật (RLS, quyền admin, migration) thì model chính tự viết và tự đọc lại kết quả của agent.

## Phần song song được trong một tính năng admin

Sau khi migration và kiểu (`shared.ts`) đã chốt, các phần sau không đụng chung file nên làm cùng lúc:

- `api.remote.ts` và `api.mock.ts` (cùng chữ ký, hai agent hoặc một người làm lần lượt).
- Trang `pages/admin/*Page.tsx`.
- Test api và test luồng.
- Tài liệu và kiểm tra giao diện.

Các file dùng chung (`shared.ts`, `api.ts`, `hooks.ts`, `routes.ts`, `router.tsx`, `AdminLayout.tsx`, `database.ts`) do model chính sửa trước, hoặc giao đúng một agent. Hai agent không được sửa cùng một file. Hai tính năng độc lập (vd phiếu và điểm chấm) thì mỗi cái một nhánh, chạy bằng `isolation: "worktree"`.

## Cách giao việc (brief)

Agent không biết gì về cuộc trò chuyện. Prompt phải có:

1. Mục tiêu và thư mục làm việc (đường dẫn tuyệt đối).
2. File cần đọc trước (mẫu để bắt chước, spec trong `documents/`), và việc đã loại trừ.
3. Phạm vi file được sửa; thứ cấm đụng.
4. Lệnh kiểm tra phải chạy xong trước khi báo (`npm run typecheck`, `npm run lint`, `npx vitest run <đường dẫn>`).
5. Dạng báo cáo: ngắn, nêu lỗi thật, không bịa kết quả.

Luôn ghi rõ trong brief:

- Không commit, không push, không `supabase db push` (thao tác production do model chính làm, và cần người dùng đồng ý).
- Không dùng simulator/di chuyển chuột của người dùng.
- Chạy nền (`run_in_background`) thì không làm trùng việc của agent đó trong lúc chờ.

## Sau khi agent xong

Agent báo "xong" chưa phải là xong: chạy lại `npm run typecheck && npm run lint && npm test` ở nhánh làm việc, đọc diff của các file agent sửa, rồi mới commit (nhớ tăng version theo quy ước trong CLAUDE.md).
