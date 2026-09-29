-- Công cụ admin, phần 2: khóa tài khoản và gỡ truyện vi phạm (plan: documents/plan-cong-cu-admin.md).
-- Khóa: auth.users.banned_until = 'infinity' và xóa phiên (Supabase Auth từ chối đăng nhập, làm mới
-- token với mã user_banned). Gỡ truyện: về nháp kèm lý do; tác giả không công khai lại được tới khi
-- admin khôi phục (mã story_taken_down).

alter table public.stories
  add column taken_down_at timestamptz,
  add column takedown_reason text check (char_length(takedown_reason) between 1 and 500),
  add constraint stories_takedown_consistent
    check ((taken_down_at is null) = (takedown_reason is null));

-- Cột mới không có trong grant update của tác giả (title, description, status, visibility,
-- cover_path) nên chỉ admin (qua RPC) đổi được.
create function private.stories_block_taken_down()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'published' and new.taken_down_at is not null then
    raise exception 'story_taken_down' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger stories_block_taken_down
  before insert or update on public.stories
  for each row execute function private.stories_block_taken_down();

-- Khu Sáng tác hiện lý do gỡ
create or replace view public.studio_stories
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.description,
  s.status,
  s.visibility,
  s.cover_path,
  s.owner_id,
  p.display_name as owner_name,
  coalesce(g.genre_slugs, '{}'::text[]) as genre_slugs,
  s.created_at,
  s.updated_at,
  s.published_at,
  coalesce(ch.total, 0) as chapter_count,
  coalesce(ch.published, 0) as published_count,
  coalesce(ch.total - ch.published, 0) as draft_count,
  st.view_count as views,
  st.follower_count as followers,
  coalesce(rp.open_reports, 0) as open_reports,
  s.taken_down_at,
  s.takedown_reason
from public.stories s
join public.profiles p on p.id = s.owner_id
join public.story_stats st on st.story_id = s.id
left join lateral (
  select array_agg(sg.genre_slug order by sg.position, sg.genre_slug) as genre_slugs
  from public.story_genres sg
  where sg.story_id = s.id
) g on true
left join lateral (
  select
    count(*)::integer as total,
    (count(*) filter (where c.status = 'published'))::integer as published
  from public.chapters c
  where c.story_id = s.id
) ch on true
left join lateral (
  select count(*)::integer as open_reports
  from public.chapter_reports r
  where r.story_id = s.id and r.status = 'open'
) rp on true
where s.owner_id = (select auth.uid());

-- ── Tổng quan: thêm số tài khoản bị khóa ───────────────────────────────

-- Kiểu AdminOverview (features/admin/shared.ts). Ngày tính theo giờ Việt Nam; p_days: 1..366.
create or replace function private.admin_overview(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 366);
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_from date := v_today - (v_days - 1);
  v_start timestamptz := v_from::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_result jsonb;
begin
  perform private.require_admin();

  with days as (
    select v_from + i as day from generate_series(0, v_days - 1) as i
  ),
  signups as (
    select (u.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from auth.users u
    where u.created_at >= v_start
    group by 1
  ),
  views as (
    select v.day, sum(v.views) as n
    from public.chapter_views v
    where v.day >= v_from
    group by 1
  ),
  new_stories as (
    select (s.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from public.stories s
    where s.created_at >= v_start
    group by 1
  ),
  new_chapters as (
    select (c.published_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from public.chapters c
    where c.published_at >= v_start
    group by 1
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'newUsers', (select count(*) from auth.users u where u.created_at >= v_start),
      'publishedStories',
        (select count(*) from public.stories s where s.visibility = 'published'),
      'draftStories', (select count(*) from public.stories s where s.visibility = 'draft'),
      'publishedChapters',
        (select count(*) from public.chapters c where c.status = 'published'),
      'views', (select coalesce(sum(st.view_count), 0) from public.story_stats st),
      'viewsInPeriod', (select coalesce(sum(v.n), 0) from views v),
      'comments', (select count(*) from public.comments),
      'openReports', (select count(*) from public.chapter_reports r where r.status = 'open'),
      'unhandledMessages',
        (select count(*) from public.contact_messages m where m.handled_at is null),
      'bannedUsers', (select count(*) from auth.users u where u.banned_until > now())
    ),
    'days', (
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'signups', coalesce(su.n, 0),
        'views', coalesce(vw.n, 0),
        'stories', coalesce(ns.n, 0),
        'chapters', coalesce(nc.n, 0)
      ) order by d.day)
      from days d
      left join signups su on su.day = d.day
      left join views vw on vw.day = d.day
      left join new_stories ns on ns.day = d.day
      left join new_chapters nc on nc.day = d.day
    ),
    'genres', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'stories', t.n)
        order by t.n desc, t.name), '[]'::jsonb)
      from (
        select g.name, count(*) as n
        from public.story_genres sg
        join public.genres g on g.slug = sg.genre_slug
        join public.stories s on s.id = sg.story_id
        where s.visibility = 'published'
        group by g.slug, g.name
        order by n desc, g.name
        limit 10
      ) t
    ),
    'topStories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'slug', t.slug,
        'title', t.title,
        'visibility', t.visibility,
        'authorName', t.author_name,
        'views', t.view_count,
        'followers', t.follower_count,
        'ratingAvg', t.rating_avg,
        'ratingCount', t.rating_count
      ) order by t.view_count desc, t.title), '[]'::jsonb)
      from (
        select s.id, s.slug, s.title, s.visibility, p.display_name as author_name,
          st.view_count, st.follower_count, st.rating_avg, st.rating_count
        from public.stories s
        join public.story_stats st on st.story_id = s.id
        join public.profiles p on p.id = s.owner_id
        where st.view_count > 0
        order by st.view_count desc, s.title
        limit 10
      ) t
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- ── Danh sách người dùng / truyện: thêm trạng thái khóa, gỡ ───────────────

drop function public.admin_users(text);
drop function private.admin_users(text);
drop function public.admin_stories(text, public.publication_status, uuid, text);
drop function private.admin_stories(text, public.publication_status, uuid, text);

create function private.admin_users(p_query text)
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  provider text,
  is_admin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  story_count integer,
  comment_count integer,
  follow_count integer,
  is_banned boolean
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
    u.id,
    u.email::text,
    coalesce(p.display_name, ''),
    p.avatar_url,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin',
    u.created_at,
    u.last_sign_in_at,
    (select count(*)::integer from public.stories s where s.owner_id = u.id),
    (select count(*)::integer from public.comments c where c.user_id = u.id),
    (select count(*)::integer from public.follows f where f.user_id = u.id),
    coalesce(u.banned_until > now(), false)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where v_q = ''
    or strpos(public.slugify(coalesce(p.display_name, '')), v_q) > 0
    or strpos(public.slugify(coalesce(u.email::text, '')), v_q) > 0
  order by u.created_at desc, u.id;
end;
$$;

create function private.admin_stories(
  p_query text,
  p_visibility public.publication_status,
  p_owner_id uuid,
  p_sort text
)
returns table (
  id uuid,
  slug text,
  title text,
  owner_id uuid,
  owner_name text,
  visibility public.publication_status,
  status public.story_status,
  published_count integer,
  chapter_count integer,
  view_count bigint,
  follower_count integer,
  rating_avg numeric,
  rating_count integer,
  comment_count integer,
  open_reports integer,
  created_at timestamptz,
  updated_at timestamptz,
  taken_down_at timestamptz,
  takedown_reason text
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
    s.id,
    s.slug,
    s.title,
    s.owner_id,
    p.display_name,
    s.visibility,
    s.status,
    st.chapter_count,
    (select count(*)::integer from public.chapters c where c.story_id = s.id),
    st.view_count,
    st.follower_count,
    st.rating_avg,
    st.rating_count,
    (select count(*)::integer from public.comments cm where cm.story_id = s.id),
    (
      select count(*)::integer from public.chapter_reports r
      where r.story_id = s.id and r.status = 'open'
    ),
    s.created_at,
    s.updated_at,
    s.taken_down_at,
    s.takedown_reason
  from public.stories s
  join public.story_stats st on st.story_id = s.id
  join public.profiles p on p.id = s.owner_id
  where (v_q = '' or strpos(s.search_title, v_q) > 0
      or strpos(public.slugify(p.display_name), v_q) > 0)
    and (p_visibility is null or s.visibility = p_visibility)
    and (p_owner_id is null or s.owner_id = p_owner_id)
  order by
    case when p_sort = 'views' then st.view_count end desc nulls last,
    case when p_sort = 'created' then s.created_at end desc nulls last,
    s.updated_at desc,
    s.id;
end;
$$;

create function public.admin_users(p_query text default null)
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  provider text,
  is_admin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  story_count integer,
  comment_count integer,
  follow_count integer,
  is_banned boolean
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_users(p_query)
$$;

create function public.admin_stories(
  p_query text default null,
  p_visibility public.publication_status default null,
  p_owner_id uuid default null,
  p_sort text default 'updated'
)
returns table (
  id uuid,
  slug text,
  title text,
  owner_id uuid,
  owner_name text,
  visibility public.publication_status,
  status public.story_status,
  published_count integer,
  chapter_count integer,
  view_count bigint,
  follower_count integer,
  rating_avg numeric,
  rating_count integer,
  comment_count integer,
  open_reports integer,
  created_at timestamptz,
  updated_at timestamptz,
  taken_down_at timestamptz,
  takedown_reason text
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_stories(p_query, p_visibility, p_owner_id, p_sort)
$$;

-- ── Khóa / mở khóa tài khoản ────────────────────────────────────────────

create function private.admin_set_user_banned(p_user_id uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean;
begin
  perform private.require_admin();
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_ban_self' using errcode = 'P0001';
  end if;
  select coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin' into v_is_admin
  from auth.users u where u.id = p_user_id;
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
end;
$$;

-- ── Gỡ / khôi phục truyện ───────────────────────────────────────────────

-- p_reason null/rỗng: khôi phục (truyện vẫn là nháp, tác giả tự xuất bản lại)
create function private.admin_set_story_takedown(p_story_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform private.require_admin();
  update public.stories s
  set taken_down_at = case when v_reason is null then null else coalesce(s.taken_down_at, now()) end,
    takedown_reason = v_reason,
    visibility = case when v_reason is null then s.visibility else 'draft' end
  where s.id = p_story_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.admin_set_user_banned(p_user_id uuid, p_banned boolean)
returns void
language sql
set search_path = ''
as $$
  select private.admin_set_user_banned(p_user_id, p_banned)
$$;

create function public.admin_set_story_takedown(p_story_id uuid, p_reason text)
returns void
language sql
set search_path = ''
as $$
  select private.admin_set_story_takedown(p_story_id, p_reason)
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.stories_block_taken_down(),
  private.admin_users(text),
  private.admin_stories(text, public.publication_status, uuid, text),
  private.admin_set_user_banned(uuid, boolean),
  private.admin_set_story_takedown(uuid, text),
  public.admin_users(text),
  public.admin_stories(text, public.publication_status, uuid, text),
  public.admin_set_user_banned(uuid, boolean),
  public.admin_set_story_takedown(uuid, text)
from public, anon, authenticated;

grant execute on function
  private.admin_users(text),
  private.admin_stories(text, public.publication_status, uuid, text),
  private.admin_set_user_banned(uuid, boolean),
  private.admin_set_story_takedown(uuid, text),
  public.admin_users(text),
  public.admin_stories(text, public.publication_status, uuid, text),
  public.admin_set_user_banned(uuid, boolean),
  public.admin_set_story_takedown(uuid, text)
to authenticated;
