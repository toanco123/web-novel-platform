---
name: db-migration
description: Dùng khi đổi schema Supabase của dự án (thêm/sửa bảng, cột, index, RLS policy, grant, trigger, hàm, RPC, view, enum), viết hoặc sửa file trong supabase/migrations hay supabase/checks, hoặc chạy supabase migration new, db push, db advisors, gen types.
---

# Đổi schema database (Supabase)

DB thật (project `zsbyjxaaxtylgmxybzpf`, CLI đã `link`) là production và đã có dữ liệu. Mọi thay đổi đi qua một migration mới, kèm ca kiểm tra trong `supabase/checks/rls_and_rules.sql`. Thiết kế hiện tại ở `documents/thiet-ke-database.md`: mục 3 bảng, 4 luật và mã lỗi, 5 RLS và quyền, 6 view/RPC, 8 bảng tra hàm `api.ts` → bảng/RPC, 9 quy trình.

## Quy trình

1. `supabase migration new <ten_tieng_anh>`: CLI đặt tên file theo giờ, không tự đặt tên file. Migration đã push thì không sửa; cần đổi thì viết migration mới.
2. Viết SQL theo quy ước bên dưới.
3. Thêm ca kiểm tra vào `supabase/checks/rls_and_rules.sql`, ngay trước dòng `select 'Tất cả kiểm tra đều qua' as ket_qua;`.
4. Thử khi chưa push. Lệnh `rollback` cuối file kiểm tra hủy luôn migration:
   ```bash
   { echo 'begin;'; cat supabase/migrations/<file>.sql supabase/checks/rls_and_rules.sql; } > "$TMPDIR/try.sql"
   supabase db query --linked -f "$TMPDIR/try.sql"
   ```
   Qua khi dòng cuối là "Tất cả kiểm tra đều qua". Ca sai ném lỗi bắt đầu bằng `FAIL`.
5. `supabase db push --dry-run` (chỉ có đúng migration mới), rồi `supabase db push`. Đây là DB production: chỉ push khi người dùng đã đồng ý.
6. `supabase db advisors --linked`: không được còn WARN. INFO "unused index" khi bảng còn ít dữ liệu thì bỏ qua được.
7. `supabase db query --linked -f supabase/checks/rls_and_rules.sql` trên schema đã push.
8. `supabase gen types typescript --linked --schema public > src/types/database.ts`. File sinh ra (đã có trong `.prettierignore`): không format, không sửa tay.
9. Cập nhật các mục bị ảnh hưởng của `thiet-ke-database.md`. Mã lỗi mới thì ghi vào mục 4 và map ở `api.remote.ts` (`businessCode`, `limitError`...).

## Quy ước SQL

| Việc                   | Cách viết                                                                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bảng mới               | `enable row level security`, rồi `revoke all on public.x from anon, authenticated;` và `grant` đúng quyền. Supabase không còn tự mở bảng mới ra Data API                                                                                                                          |
| Grant theo cột         | `grant insert (a, b) on public.x to authenticated;` chỉ có tác dụng khi không có quyền mức bảng. Cột `user_id`, `created_at` để DB đặt (`default auth.uid()`, `default now()`). Upsert của PostgREST ghi lại mọi cột trong payload nên cần quyền update cả bảng                   |
| Policy                 | Mỗi thao tác một policy, tên `<bang>_<thao_tac>_<ai>`, luôn ghi `to authenticated`/`to anon`, dùng `(select auth.uid())` chứ không gọi thẳng `auth.uid()`                                                                                                                         |
| Hàm `security definer` | Đặt ở schema `private`, luôn `set search_path = ''`, gọi bảng bằng tên đầy đủ (`public.stories`). Người dùng hoặc khách cần gọi thì làm lớp vỏ ở `public` (`language sql`, invoker, cũng `set search_path = ''`) gọi sang, như `public.report_comment` → `private.report_comment` |
| Quyền chạy hàm         | Cuối migration: `revoke execute on function … from public, anon, authenticated;` cho mọi hàm mới (kể cả hàm trigger), rồi `grant execute` đúng hàm cho đúng vai trò, cả hàm `private` lẫn lớp vỏ `public`                                                                         |
| RPC quản trị           | `private.admin_*` gọi `perform private.require_admin();` ở đầu thân hàm, chỉ grant cho `authenticated`. Bảng quản trị lọc/sắp xếp bằng `.eq()`/`.order()` trên kết quả RPC, nên hàm phải trả đủ các cột đó                                                                        |
| Luật nghiệp vụ         | Đặt ở trigger hoặc RPC: `raise exception 'ma_loi' using errcode = 'P0001';`. Client đọc mã bằng `businessCode(error)`. Vượt giới hạn tần suất: `rate_limited`; trùng khóa: `23505`                                                                                                |
| Khóa ngoại             | `on delete cascade` khi dữ liệu phải mất theo tài khoản, truyện hay chương; thêm index cho cột khóa ngoại                                                                                                                                                                         |
| Ghi chú                | Bình luận SQL bằng tiếng Việt, chia khối bằng `-- ── 1. Tên khối ───`                                                                                                                                                                                                             |

## Viết ca kiểm tra

Hàm có sẵn ở đầu `rls_and_rules.sql`:

- `pg_temp.expect(<điều kiện>, 'mô tả')`
- `pg_temp.expect_error($$<câu lệnh>$$, '<SQLSTATE hoặc mã lỗi>')`, vd `'42501'` (không có quyền), `'23505'`, `'not_found'`
- `pg_temp.affected($$<update/delete>$$)`: số dòng bị tác động. RLS chặn update/delete thì ra 0, không báo lỗi
- `pg_temp.story_id('<slug>')`; `pg_temp.approve('<slug>')` duyệt truyện (gọi sau `reset role`)

Đóng vai:

```sql
reset role;  -- quyền chủ phiên: tạo người dùng (insert auth.users), dữ liệu mẫu
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000xx", "role": "authenticated"}', true);
set local role authenticated;  -- khách: set local role anon
-- Quản trị viên: thêm "app_metadata": {"role": "admin"} vào claims
```

- Khối kiểm tra mới tự tạo người dùng riêng (`insert into auth.users (id, email, raw_user_meta_data)`, uuid chưa dùng, email `@kiem-tra.local`): một số người dùng của các khối trước đã bị xóa giữa file.
- DB thật có dữ liệu: không đếm trên cả bảng. Lọc theo slug/uuid của dữ liệu mẫu, hoặc loại truyện có sẵn bằng bảng tạm `existing_stories`.
- Mỗi luật cần cả ca được phép lẫn ca bị chặn; mỗi mã lỗi mới cần một `expect_error`.
- Ca "người khác không xóa/sửa được dòng mà họ không thấy": chạy bằng người không có dòng nào, câu lệnh không có `where` theo cột của bảng, `affected` phải ra 0. Có `where` theo cột thì Postgres lọc thêm bằng policy select, nên policy delete/update hỏng vẫn ra 0 dòng.
