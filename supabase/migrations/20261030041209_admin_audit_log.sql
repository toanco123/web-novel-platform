-- Nhật ký thao tác admin (plan documents/plan-nhat-ky-admin.md). Mỗi RPC ghi của admin gọi
-- private.admin_log trong cùng giao dịch, nên không thao tác được mà thiếu dòng nhật ký; thao tác
-- lỗi (rollback) cũng không để lại dòng. Bảng nằm ở schema private, chỉ hàm DEFINER đọc/ghi.

-- ── 1. Bảng ─────────────────────────────────────────────────────────────

create table private.admin_audit_log (
  id bigint generated always as identity primary key,
  -- Người làm; tài khoản bị xóa thì dòng nhật ký còn, actor_name giữ tên lúc đó
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null,
  -- 'user.ban', 'story.takedown'... Nhóm = phần trước dấu chấm
  action text not null,
  target_type text not null,
  target_id text not null,
  -- Tên đối tượng lúc đó (đối tượng có thể bị xóa sau này)
  target_label text not null default '',
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on private.admin_audit_log (created_at desc, id desc);
create index admin_audit_log_actor_idx on private.admin_audit_log (actor_id);
create index admin_audit_log_action_idx on private.admin_audit_log (action);

alter table private.admin_audit_log enable row level security;
revoke all on private.admin_audit_log from public, anon, authenticated;

-- ── 2. Ghi một dòng ─────────────────────────────────────────────────────
-- Không ai gọi được qua API; chỉ các hàm admin DEFINER bên dưới gọi.
create function private.admin_log(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text,
  p_details jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text;
begin
  select coalesce(nullif(p.display_name, ''), u.email::text, '') into v_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_actor;

  insert into private.admin_audit_log
    (actor_id, actor_name, action, target_type, target_id, target_label, details)
  values (
    v_actor, coalesce(v_name, ''), p_action, p_target_type, p_target_id,
    left(coalesce(p_target_label, ''), 200), coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- ── 3. Các RPC ghi của admin: giữ nguyên luật, thêm một lần ghi nhật ký ──────

create or replace function private.admin_set_user_banned(p_user_id uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_label text;
begin
  perform private.require_admin();
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_ban_self' using errcode = 'P0001';
  end if;
  select coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin',
    coalesce(nullif(p.display_name, ''), u.email::text)
  into v_is_admin, v_label
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;
  if v_is_admin is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_is_admin and p_banned then
    raise exception 'cannot_ban_admin' using errcode = 'P0001';
  end if;

  update auth.users u
  set banned_until = case when p_banned then 'infinity'::timestamptz end
  where u.id = p_user_id;
  -- Đăng xuất khỏi mọi thiết bị: không làm mới token được nữa (token đang dùng hết hạn sau ≤ 1 giờ)
  if p_banned then
    delete from auth.sessions s where s.user_id = p_user_id;
  end if;

  perform private.admin_log(
    case when p_banned then 'user.ban' else 'user.unban' end, 'user', p_user_id::text, v_label);
end;
$$;

create or replace function private.admin_set_story_takedown(p_story_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  v_title text;
begin
  perform private.require_admin();
  update public.stories s
  set taken_down_at = case when v_reason is null then null else coalesce(s.taken_down_at, now()) end,
    takedown_reason = v_reason,
    visibility = case when v_reason is null then s.visibility else 'draft' end,
    -- Gỡ thì mất dấu đã duyệt (truyện chờ duyệt cũng rời hàng chờ); khôi phục không đổi
    review_status = case when v_reason is null then s.review_status end,
    review_submitted_at = case when v_reason is null then s.review_submitted_at end,
    reviewed_at = case when v_reason is null then s.reviewed_at end,
    review_reason = case when v_reason is null then s.review_reason end
  where s.id = p_story_id
  returning s.title into v_title;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform private.admin_log(
    case when v_reason is null then 'story.restore' else 'story.takedown' end,
    'story', p_story_id::text, v_title, jsonb_build_object('reason', v_reason));
end;
$$;

create or replace function private.admin_review_story(
  p_story_id uuid, p_approve boolean, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status public.review_status;
  v_title text;
begin
  perform private.require_admin();
  select s.review_status, s.title into v_status, v_title
  from public.stories s where s.id = p_story_id for update;
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
    perform private.admin_log('story.approve', 'story', p_story_id::text, v_title);
  else
    if v_reason is null then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    update public.stories
    set review_status = 'rejected', reviewed_at = now(), review_reason = left(v_reason, 500)
    where id = p_story_id;
    perform private.admin_log('story.reject', 'story', p_story_id::text, v_title,
      jsonb_build_object('reason', left(v_reason, 500)));
  end if;
end;
$$;

create or replace function private.admin_delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content text;
  v_author text;
  v_story text;
  v_replies integer;
begin
  perform private.require_admin();
  select c.content, p.display_name, s.title,
    (select count(*)::integer from public.comments r where r.parent_id = c.id)
  into v_content, v_author, v_story, v_replies
  from public.comments c
  join public.stories s on s.id = c.story_id
  left join public.profiles p on p.id = c.user_id
  where c.id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  delete from public.comments c where c.id = p_id;

  perform private.admin_log('comment.delete', 'comment', p_id::text, left(v_content, 80),
    jsonb_build_object(
      'content', left(v_content, 500), 'author', v_author, 'story', v_story, 'replies', v_replies));
end;
$$;

create or replace function private.admin_dismiss_comment_reports(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_content text;
begin
  perform private.require_admin();
  with closed as (
    update private.comment_reports r
    set status = 'resolved', resolved_at = now()
    where r.comment_id = p_comment_id and r.status = 'open'
    returning 1
  )
  select count(*)::integer into v_n from closed;

  -- Không có báo cáo nào đang mở thì không có gì để ghi
  if v_n > 0 then
    select c.content into v_content from public.comments c where c.id = p_comment_id;
    perform private.admin_log('comment.dismiss_reports', 'comment', p_comment_id::text,
      left(coalesce(v_content, ''), 80), jsonb_build_object('reports', v_n));
  end if;
end;
$$;

create or replace function private.admin_delete_rating(p_user_id uuid, p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score smallint;
  v_story text;
  v_user text;
begin
  perform private.require_admin();
  select r.score, s.title, p.display_name into v_score, v_story, v_user
  from public.ratings r
  join public.stories s on s.id = r.story_id
  left join public.profiles p on p.id = r.user_id
  where r.user_id = p_user_id and r.story_id = p_story_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  delete from public.ratings r where r.user_id = p_user_id and r.story_id = p_story_id;

  perform private.admin_log('rating.delete', 'rating', p_user_id::text || ':' || p_story_id::text,
    v_story, jsonb_build_object('user', v_user, 'score', v_score));
end;
$$;

create or replace function private.admin_update_genre(
  p_slug text, p_name text, p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_slug text := public.slugify(v_name);
  v_row public.genres;
  v_old text;
begin
  perform private.require_admin();
  if exists (select 1 from public.genres g where g.slug = v_slug and g.slug <> p_slug) then
    raise exception 'genre_exists' using errcode = 'P0001';
  end if;
  select g.name into v_old from public.genres g where g.slug = p_slug;
  update public.genres g
  set name = v_name, slug = v_slug, description = nullif(btrim(p_description), '')
  where g.slug = p_slug
  returning * into v_row;
  if v_row.slug is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform private.admin_log('genre.update', 'genre', v_row.slug, v_row.name,
    jsonb_build_object('from_name', v_old, 'from_slug', p_slug));
  return jsonb_build_object('slug', v_row.slug, 'name', v_row.name, 'description', v_row.description);
end;
$$;

create or replace function private.admin_delete_genre(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_stories integer;
begin
  perform private.require_admin();
  select g.name, (select count(*)::integer from public.story_genres sg where sg.genre_slug = g.slug)
  into v_name, v_stories
  from public.genres g where g.slug = p_slug;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  delete from public.genres g where g.slug = p_slug;

  perform private.admin_log('genre.delete', 'genre', p_slug, v_name,
    jsonb_build_object('stories', v_stories));
end;
$$;

create or replace function private.admin_merge_genres(p_from text, p_into text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_ids uuid[];
  v_positions smallint[];
  v_moved integer;
  v_from_name text;
  v_into_name text;
begin
  perform private.require_admin();
  if p_from = p_into then
    raise exception 'same_genre' using errcode = 'P0001';
  end if;
  if (select count(*) from public.genres g where g.slug in (p_from, p_into)) < 2 then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select g.name into v_from_name from public.genres g where g.slug = p_from;
  select g.name into v_into_name from public.genres g where g.slug = p_into;

  select coalesce(array_agg(sg.story_id), '{}'), coalesce(array_agg(sg.position), '{}')
  into v_story_ids, v_positions
  from public.story_genres sg
  where sg.genre_slug = p_from;

  delete from public.genres g where g.slug = p_from;

  insert into public.story_genres (story_id, genre_slug, position)
  select t.story_id, p_into, t.position
  from unnest(v_story_ids, v_positions) as t(story_id, position)
  where not exists (
    select 1 from public.story_genres sg where sg.story_id = t.story_id and sg.genre_slug = p_into
  );
  get diagnostics v_moved = row_count;

  perform private.admin_log('genre.merge', 'genre', p_from, v_from_name,
    jsonb_build_object('into', v_into_name, 'into_slug', p_into, 'moved', v_moved));
  return v_moved;
end;
$$;

create or replace function private.admin_set_curated(p_list text, p_story_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_limit integer;
begin
  perform private.require_admin();
  v_limit := case p_list when 'featured' then 8 when 'editor_pick' then 12 end;
  if v_limit is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(t.id order by t.first_pos), '{}') into v_ids
  from (
    select u.id, min(u.pos) as first_pos
    from unnest(coalesce(p_story_ids, '{}')) with ordinality as u(id, pos)
    group by u.id
  ) t;

  if cardinality(v_ids) > v_limit then
    raise exception 'too_many_curated' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(v_ids) as u(id)
    where not exists (select 1 from public.stories s where s.id = u.id)
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  delete from public.curated_stories c where c.list = p_list;
  insert into public.curated_stories (list, story_id, position)
  select p_list, u.id, u.pos::smallint
  from unnest(v_ids) with ordinality as u(id, pos);

  perform private.admin_log('curated.set', 'list', p_list,
    case p_list when 'featured' then 'Banner nổi bật' else 'Truyện đề cử' end,
    jsonb_build_object('count', cardinality(v_ids), 'story_ids', to_jsonb(v_ids)));
end;
$$;

create or replace function private.admin_set_contact_handled(p_id bigint, p_handled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_topic text;
begin
  perform private.require_admin();
  update public.contact_messages m
  set handled_at = case when p_handled then coalesce(m.handled_at, now()) end
  where m.id = p_id
  returning m.name, m.topic::text into v_name, v_topic;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform private.admin_log(
    case when p_handled then 'message.handle' else 'message.unhandle' end,
    'message', p_id::text, v_name, jsonb_build_object('topic', v_topic));
end;
$$;

create or replace function private.admin_set_report_status(
  p_id uuid, p_status public.report_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
  v_chapter integer;
  v_title text;
begin
  perform private.require_admin();
  update public.chapter_reports r set status = p_status where r.id = p_id
  returning r.story_id, r.chapter_number into v_story_id, v_chapter;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select s.title into v_title from public.stories s where s.id = v_story_id;

  perform private.admin_log('report.set_status', 'report', p_id::text,
    coalesce(v_title, '') || ' · chương ' || v_chapter, jsonb_build_object('status', p_status));
end;
$$;

-- ── 4. Đọc nhật ký ──────────────────────────────────────────────────────
-- action_group = phần trước dấu chấm của action (user, story, comment, rating, genre, curated,
-- message, report); client lọc theo cột này và theo actor_id. Tìm theo tên người làm / đối tượng.
create function private.admin_audit_log(p_query text)
returns table (
  id bigint,
  actor_id uuid,
  actor_name text,
  action text,
  action_group text,
  target_type text,
  target_id text,
  target_label text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.slugify(coalesce(p_query, ''));
begin
  perform private.require_admin();

  return query
  select
    l.id, l.actor_id, l.actor_name, l.action, split_part(l.action, '.', 1),
    l.target_type, l.target_id, l.target_label, l.details, l.created_at
  from private.admin_audit_log l
  where v_q = ''
    or strpos(public.slugify(l.actor_name), v_q) > 0
    or strpos(public.slugify(l.target_label), v_q) > 0
  order by l.created_at desc, l.id desc;
end;
$$;

create function public.admin_audit_log(p_query text default null)
returns table (
  id bigint,
  actor_id uuid,
  actor_name text,
  action text,
  action_group text,
  target_type text,
  target_id text,
  target_label text,
  details jsonb,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_audit_log(p_query)
$$;

-- ── 5. Quyền ────────────────────────────────────────────────────────────
-- Hàm đã có giữ nguyên quyền cũ (create or replace). Hàm mới: admin_log không ai gọi được qua API.

revoke execute on function
  private.admin_log(text, text, text, text, jsonb),
  private.admin_audit_log(text),
  public.admin_audit_log(text)
from public, anon, authenticated;

grant execute on function
  private.admin_audit_log(text),
  public.admin_audit_log(text)
to authenticated;
