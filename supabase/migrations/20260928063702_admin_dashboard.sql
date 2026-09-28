-- Trang quản trị /quan-tri (chỉ xem): số liệu tổng quan, danh sách người dùng, danh sách truyện.
-- Quản trị viên = auth.users.raw_app_meta_data.role = 'admin' (người dùng không tự sửa được
-- app_metadata; có sẵn trong JWT). Cách cấp quyền: mục 10 documents/thiet-ke-database.md.
-- Cần đọc auth.users (email, lần đăng nhập) và truyện nháp của mọi người nên phần chạy quyền cao
-- (DEFINER) nằm ở private; hàm ở public chỉ là lớp vỏ SECURITY INVOKER (như record_chapter_view).

create function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create function private.require_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
end;
$$;

-- ── Tổng quan ───────────────────────────────────────────────────────────

-- Kiểu AdminOverview (features/admin/shared.ts). Ngày tính theo giờ Việt Nam; p_days: 1..366.
create function private.admin_overview(p_days integer)
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
      'openReports', (select count(*) from public.chapter_reports r where r.status = 'open')
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

-- ── Người dùng ──────────────────────────────────────────────────────────

-- Kiểu AdminUser; lọc tên/email không dấu, mới tham gia trước. Client phân trang bằng range().
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
  follow_count integer
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
    (select count(*)::integer from public.follows f where f.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where v_q = ''
    or strpos(public.slugify(coalesce(p.display_name, '')), v_q) > 0
    or strpos(public.slugify(coalesce(u.email::text, '')), v_q) > 0
  order by u.created_at desc, u.id;
end;
$$;

-- ── Truyện ──────────────────────────────────────────────────────────────

-- Kiểu AdminStory, gồm cả truyện nháp. p_sort: updated (mặc định) | views | created.
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
  updated_at timestamptz
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
    s.updated_at
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

-- ── Lớp vỏ ở public (gọi qua /rest/v1/rpc) ─────────────────────────────

create function public.admin_overview(p_days integer default 30)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.admin_overview(p_days)
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
  follow_count integer
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
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_stories(p_query, p_visibility, p_owner_id, p_sort)
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────
-- Khách không gọi được (42501); người đăng nhập không phải quản trị viên nhận lỗi 'forbidden'.

revoke execute on function
  private.is_admin(),
  private.require_admin(),
  private.admin_overview(integer),
  private.admin_users(text),
  private.admin_stories(text, public.publication_status, uuid, text)
from public, anon, authenticated;

grant execute on function
  private.admin_overview(integer),
  private.admin_users(text),
  private.admin_stories(text, public.publication_status, uuid, text)
to authenticated;

revoke execute on function
  public.admin_overview(integer),
  public.admin_users(text),
  public.admin_stories(text, public.publication_status, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.admin_overview(integer),
  public.admin_users(text),
  public.admin_stories(text, public.publication_status, uuid, text)
to authenticated;
