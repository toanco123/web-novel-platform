-- Thích bình luận, sửa bình luận, chủ truyện xóa bình luận trong truyện của mình
-- (plan: documents/plan-thich-sua-xoa-binh-luan.md).
-- Tương thích ngược với app di động: chỉ thêm cột, bảng, policy; comment_threads giữ các cột cũ.

-- ── 1. Thích bình luận ──────────────────────────────────────────────────

-- Số lượt thích do trigger ghi (client không có quyền update cột này)
alter table public.comments
  add column like_count integer not null default 0 check (like_count >= 0);

create table public.comment_likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index comment_likes_comment_id_idx on public.comment_likes (comment_id);
-- Đếm lượt thích mới trong một giờ của một người (giới hạn tần suất)
create index comment_likes_user_id_created_at_idx
  on public.comment_likes (user_id, created_at desc);

alter table public.comment_likes enable row level security;
revoke all on public.comment_likes from anon, authenticated;
-- Khách cần quyền đọc vì comment_threads (invoker) tính liked_by_me; không có policy cho anon nên
-- khách không thấy dòng nào
grant select on public.comment_likes to anon, authenticated;
grant delete on public.comment_likes to authenticated;
grant insert (comment_id) on public.comment_likes to authenticated;

-- Mỗi người chỉ thấy lượt thích của mình (không có danh sách ai đã thích)
create policy comment_likes_select_own on public.comment_likes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Thích bình luận của truyện đang công khai. Tự thích bị trigger chặn trước (mã lỗi rõ hơn 42501)
create policy comment_likes_insert_own on public.comment_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.comments c
      join public.stories s on s.id = c.story_id
      where c.id = comment_likes.comment_id and s.visibility = 'published'
    )
  );

create policy comment_likes_delete_own on public.comment_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Không tự thích bình luận của mình; tối đa 300 lượt thích mới / giờ.
-- DEFINER để thấy bình luận dù RLS có che (khi đó policy insert chặn sau).
create function private.comment_likes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  select c.user_id into v_author from public.comments c where c.id = new.comment_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_author = new.user_id then
    raise exception 'own_comment_like' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.comment_likes l
    where l.user_id = new.user_id and l.created_at > now() - interval '1 hour'
  ) >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger comment_likes_guard
  before insert on public.comment_likes
  for each row execute function private.comment_likes_guard();

-- Cập nhật comments.like_count. Bình luận bị xóa (cascade) thì không còn dòng để cập nhật.
create function private.comment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments c set like_count = c.like_count + 1 where c.id = new.comment_id;
  else
    update public.comments c set like_count = greatest(c.like_count - 1, 0)
    where c.id = old.comment_id;
  end if;
  return null;
end;
$$;

create trigger comment_likes_count
  after insert or delete on public.comment_likes
  for each row execute function private.comment_likes_count();

-- ── 2. Sửa bình luận ────────────────────────────────────────────────────

alter table public.comments add column edited_at timestamptz;

grant update (content) on public.comments to authenticated;

-- Người viết sửa khi truyện còn công khai (và chương còn xuất bản), như điều kiện viết bình luận
create policy comments_update_own on public.comments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = comments.story_id and s.visibility = 'published'
    )
    and (
      comments.chapter_number is null
      or exists (
        select 1 from public.chapters c
        where c.story_id = comments.story_id
          and c.number = comments.chapter_number
          and c.status = 'published'
      )
    )
  );

-- Nội dung đổi thì ghi lúc sửa. Trigger đếm lượt thích cũng update comments nhưng không đổi nội dung.
create function private.comments_set_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger comments_set_edited_at
  before update on public.comments
  for each row execute function private.comments_set_edited_at();

-- Báo cáo giữ nội dung lúc bị báo cáo, để sửa bình luận không xóa được dấu vết.
-- null: báo cáo tạo trước khi có cột này.
alter table private.comment_reports
  add column content_snapshot text check (char_length(content_snapshot) <= 1000);

-- Như bản cũ, thêm lưu content_snapshot khi tạo và khi báo lại
create or replace function private.report_comment(
  p_comment_id uuid,
  p_reason public.comment_report_reason,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_author uuid;
  v_content text;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  select c.user_id, c.content into v_author, v_content
  from public.comments c
  join public.stories s on s.id = c.story_id
  where c.id = p_comment_id and s.visibility = 'published';
  if v_author is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_author = v_uid then
    raise exception 'own_comment' using errcode = 'P0001';
  end if;

  update private.comment_reports r
  set reason = p_reason, note = v_note, created_at = now(), content_snapshot = v_content
  where r.reporter_id = v_uid and r.comment_id = p_comment_id and r.status = 'open';
  if found then
    return;
  end if;

  if (
    select count(*) from private.comment_reports r
    where r.reporter_id = v_uid and r.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into private.comment_reports as r (comment_id, reporter_id, reason, note, content_snapshot)
  values (p_comment_id, v_uid, p_reason, v_note, v_content)
  on conflict (reporter_id, comment_id) where status = 'open'
  do update set
    reason = excluded.reason,
    note = excluded.note,
    created_at = now(),
    content_snapshot = excluded.content_snapshot;
end;
$$;

-- ── 3. Chủ truyện xóa bình luận trong truyện của mình ───────────────────

drop policy comments_delete_own on public.comments;
create policy comments_delete_author_or_owner on public.comments
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = comments.story_id and s.owner_id = (select auth.uid())
    )
  );

-- ── 4. comment_threads: thêm lượt thích, lúc sửa, nhãn Tác giả ──────────

-- Đổi kiểu trả về nên phải drop. Các cột cũ giữ nguyên tên và thứ tự (app di động đang đọc).
drop function public.comment_threads(uuid, integer);

-- is_author: người viết là chủ truyện và truyện không có bút danh (truyện nhập dưới bút danh của
-- người khác thì bình luận của quản trị viên không mang nhãn). INVOKER: RLS áp dụng.
create function public.comment_threads(p_story_id uuid, p_chapter integer default null)
returns table (
  id uuid,
  chapter_number integer,
  content text,
  created_at timestamptz,
  user_id uuid,
  display_name text,
  avatar_url text,
  reply_count integer,
  like_count integer,
  liked_by_me boolean,
  edited_at timestamptz,
  is_author boolean
)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    c.chapter_number,
    c.content,
    c.created_at,
    p.id,
    p.display_name,
    p.avatar_url,
    (select count(*)::integer from public.comments r where r.parent_id = c.id),
    c.like_count,
    exists (
      select 1 from public.comment_likes l
      where l.comment_id = c.id and l.user_id = (select auth.uid())
    ),
    c.edited_at,
    c.user_id = s.owner_id and s.author_name is null
  from public.comments c
  join public.profiles p on p.id = c.user_id
  join public.stories s on s.id = c.story_id
  where c.story_id = p_story_id
    and c.parent_id is null
    and (
      (p_chapter is null and c.chapter_number is null)
      or c.chapter_number = p_chapter
    )
$$;

-- ── 5. admin_comments: thêm lúc sửa và nội dung lúc bị báo cáo ──────────

drop function public.admin_comments(text, boolean);
drop function private.admin_comments(text, boolean);

-- Như bản cũ, thêm cột edited_at và khóa contentSnapshot trong từng báo cáo
create function private.admin_comments(p_query text, p_reported boolean)
returns table (
  id uuid,
  content text,
  created_at timestamptz,
  is_reply boolean,
  reply_count integer,
  user_id uuid,
  user_name text,
  story_slug text,
  story_title text,
  story_visibility public.publication_status,
  chapter_number integer,
  reports jsonb,
  last_reported_at timestamptz,
  edited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.slugify(coalesce(p_query, ''));
  v_reported boolean := coalesce(p_reported, false);
begin
  perform private.require_admin();

  return query
  select
    c.id,
    c.content,
    c.created_at,
    c.parent_id is not null,
    (select count(*)::integer from public.comments r where r.parent_id = c.id),
    c.user_id,
    p.display_name,
    s.slug,
    s.title,
    s.visibility,
    c.chapter_number,
    coalesce(rp.reports, '[]'::jsonb),
    rp.last_reported_at,
    c.edited_at
  from public.comments c
  join public.stories s on s.id = c.story_id
  join public.profiles p on p.id = c.user_id
  left join lateral (
    select
      jsonb_agg(jsonb_build_object(
        'reason', r.reason,
        'note', r.note,
        'reporterName', rep.display_name,
        'createdAt', r.created_at,
        'contentSnapshot', r.content_snapshot
      ) order by r.created_at desc) as reports,
      max(r.created_at) as last_reported_at
    from private.comment_reports r
    join public.profiles rep on rep.id = r.reporter_id
    where r.comment_id = c.id and r.status = 'open'
  ) rp on true
  where (v_q = ''
      or strpos(public.slugify(c.content), v_q) > 0
      or strpos(public.slugify(p.display_name), v_q) > 0)
    and (not v_reported or rp.last_reported_at is not null)
  order by
    case when v_reported then rp.last_reported_at end desc nulls last,
    c.created_at desc,
    c.id;
end;
$$;

create function public.admin_comments(p_query text default null, p_reported boolean default false)
returns table (
  id uuid,
  content text,
  created_at timestamptz,
  is_reply boolean,
  reply_count integer,
  user_id uuid,
  user_name text,
  story_slug text,
  story_title text,
  story_visibility public.publication_status,
  chapter_number integer,
  reports jsonb,
  last_reported_at timestamptz,
  edited_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_comments(p_query, p_reported)
$$;

-- ── 6. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function
  private.comment_likes_guard(),
  private.comment_likes_count(),
  private.comments_set_edited_at(),
  private.report_comment(uuid, public.comment_report_reason, text),
  private.admin_comments(text, boolean),
  public.comment_threads(uuid, integer),
  public.admin_comments(text, boolean)
from public, anon, authenticated;

grant execute on function public.comment_threads(uuid, integer) to anon, authenticated;

grant execute on function
  private.report_comment(uuid, public.comment_report_reason, text),
  private.admin_comments(text, boolean),
  public.admin_comments(text, boolean)
to authenticated;
