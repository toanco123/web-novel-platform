-- Công cụ admin, phần 1: hộp thư liên hệ và báo lỗi chương của toàn web
-- (plan: documents/plan-cong-cu-admin.md). Mẫu như migration admin_dashboard: phần chạy quyền cao
-- ở private (tự kiểm tra private.require_admin()), lớp vỏ SECURITY INVOKER ở public.

alter table public.contact_messages add column handled_at timestamptz;
create index contact_messages_unhandled_created_at_idx
  on public.contact_messages (created_at desc) where handled_at is null;

-- ── Tổng quan: thêm số tin nhắn chưa xử lý ─────────────────────────────

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
        (select count(*) from public.contact_messages m where m.handled_at is null)
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

-- ── Hộp thư liên hệ ─────────────────────────────────────────────────────

-- p_status: open (chưa xử lý) | handled | null (tất cả); mới trước
create function private.admin_contact_messages(p_status text)
returns table (
  id bigint,
  user_id uuid,
  name text,
  email text,
  topic public.contact_topic,
  message text,
  created_at timestamptz,
  handled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select m.id, m.user_id, m.name, m.email, m.topic, m.message, m.created_at, m.handled_at
  from public.contact_messages m
  where p_status is null
    or (p_status = 'open' and m.handled_at is null)
    or (p_status = 'handled' and m.handled_at is not null)
  order by m.created_at desc, m.id desc;
end;
$$;

create function private.admin_set_contact_handled(p_id bigint, p_handled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.contact_messages m
  set handled_at = case when p_handled then coalesce(m.handled_at, now()) end
  where m.id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ── Báo lỗi chương của toàn web ─────────────────────────────────────────

-- p_status: open | resolved | null (tất cả); mới trước
create function private.admin_reports(p_status public.report_status)
returns table (
  id uuid,
  story_id uuid,
  story_slug text,
  story_title text,
  story_visibility public.publication_status,
  chapter_number integer,
  chapter_title text,
  reason public.report_reason,
  note text,
  status public.report_status,
  reporter_id uuid,
  reporter_name text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  select
    r.id, s.id, s.slug, s.title, s.visibility, r.chapter_number, c.title, r.reason, r.note,
    r.status, r.reporter_id, p.display_name, r.created_at, r.resolved_at
  from public.chapter_reports r
  join public.stories s on s.id = r.story_id
  join public.chapters c on c.story_id = r.story_id and c.number = r.chapter_number
  join public.profiles p on p.id = r.reporter_id
  where p_status is null or r.status = p_status
  order by r.created_at desc, r.id;
end;
$$;

-- Trigger chapter_reports_set_resolved_at tự đặt/xóa resolved_at
create function private.admin_set_report_status(p_id uuid, p_status public.report_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.chapter_reports r set status = p_status where r.id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ── Lớp vỏ ở public ─────────────────────────────────────────────────────

create function public.admin_contact_messages(p_status text default null)
returns table (
  id bigint,
  user_id uuid,
  name text,
  email text,
  topic public.contact_topic,
  message text,
  created_at timestamptz,
  handled_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_contact_messages(p_status)
$$;

create function public.admin_set_contact_handled(p_id bigint, p_handled boolean)
returns void
language sql
set search_path = ''
as $$
  select private.admin_set_contact_handled(p_id, p_handled)
$$;

create function public.admin_reports(p_status public.report_status default null)
returns table (
  id uuid,
  story_id uuid,
  story_slug text,
  story_title text,
  story_visibility public.publication_status,
  chapter_number integer,
  chapter_title text,
  reason public.report_reason,
  note text,
  status public.report_status,
  reporter_id uuid,
  reporter_name text,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_reports(p_status)
$$;

create function public.admin_set_report_status(p_id uuid, p_status public.report_status)
returns void
language sql
set search_path = ''
as $$
  select private.admin_set_report_status(p_id, p_status)
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.admin_contact_messages(text),
  private.admin_set_contact_handled(bigint, boolean),
  private.admin_reports(public.report_status),
  private.admin_set_report_status(uuid, public.report_status),
  public.admin_contact_messages(text),
  public.admin_set_contact_handled(bigint, boolean),
  public.admin_reports(public.report_status),
  public.admin_set_report_status(uuid, public.report_status)
from public, anon, authenticated;

grant execute on function
  private.admin_contact_messages(text),
  private.admin_set_contact_handled(bigint, boolean),
  private.admin_reports(public.report_status),
  private.admin_set_report_status(uuid, public.report_status),
  public.admin_contact_messages(text),
  public.admin_set_contact_handled(bigint, boolean),
  public.admin_reports(public.report_status),
  public.admin_set_report_status(uuid, public.report_status)
to authenticated;
