-- Chặn người dùng (App Store Guideline 1.2 cho nội dung do người dùng đăng): người đọc chặn một tài
-- khoản thì không còn thấy bình luận, trả lời của tài khoản đó (cả web lẫn app), số trả lời cũng
-- không đếm chúng. Chặn là riêng của từng người: người bị chặn không biết, người khác vẫn thấy bình
-- thường. App có màn quản lý danh sách đã chặn (bỏ chặn).

-- ── 1. Bảng user_blocks ─────────────────────────────────────────────────

create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Khóa ngoại sang profiles để PostgREST nhúng tên, ảnh của người bị chặn (danh sách đã chặn)
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

-- Khóa chính đã có chỉ mục theo blocker_id; thêm chỉ mục cho khóa ngoại blocked_id
create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
-- blocker_id, created_at do DB đặt: chỉ cho ghi blocked_id
grant select, delete on public.user_blocks to authenticated;
grant insert (blocked_id) on public.user_blocks to authenticated;

create policy user_blocks_select_own on public.user_blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- ── 2. Danh sách người mình đã chặn ─────────────────────────────────────

-- security definer: policy của comments gọi được cả khi là khách (khách không có quyền đọc bảng
-- user_blocks); khách và người chưa chặn ai nhận mảng rỗng
create function private.my_blocked_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(b.blocked_id), '{}')
  from public.user_blocks b
  where b.blocker_id = (select auth.uid())
$$;

-- ── 3. Ẩn bình luận của người mình đã chặn ──────────────────────────────

-- comment_threads (bình luận gốc, số trả lời) và đọc trả lời đều đi qua policy này.
-- (select ...) để Postgres tính danh sách một lần cho cả câu truy vấn, không tính lại từng dòng.
drop policy comments_select_visible on public.comments;
create policy comments_select_visible on public.comments
  for select to anon, authenticated
  using (
    exists (select 1 from public.stories s where s.id = comments.story_id)
    and comments.user_id <> all ((select private.my_blocked_ids())::uuid[])
  );

-- ── 4. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function private.my_blocked_ids() from public, anon, authenticated;
grant execute on function private.my_blocked_ids() to anon, authenticated;
