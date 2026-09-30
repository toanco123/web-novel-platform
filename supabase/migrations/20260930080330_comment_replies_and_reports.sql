-- Trả lời bình luận (một cấp) và kiểm duyệt bình luận
-- (plan: documents/plan-tra-loi-va-kiem-duyet-binh-luan.md).

-- ── 1. Trả lời bình luận ────────────────────────────────────────────────

-- null: bình luận gốc. Xóa bình luận gốc thì trả lời mất theo.
alter table public.comments
  add column parent_id uuid references public.comments (id) on delete cascade;

create index comments_parent_id_created_at_idx
  on public.comments (parent_id, created_at) where parent_id is not null;

grant insert (parent_id) on public.comments to authenticated;

-- Chỉ một cấp: bình luận gốc phải tồn tại, không phải là một trả lời, và cùng truyện, cùng chương.
-- DEFINER để thấy bình luận gốc dù RLS có che (khi đó RLS của chính lệnh insert sẽ chặn sau).
create function private.comments_check_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.comments;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into v_parent from public.comments c where c.id = new.parent_id;
  if not found then
    raise exception 'parent_not_found' using errcode = 'P0001';
  end if;
  if v_parent.parent_id is not null
    or v_parent.story_id <> new.story_id
    or v_parent.chapter_number is distinct from new.chapter_number
  then
    raise exception 'invalid_parent' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Tên đứng trước comments_rate_limit nên chạy trước: trả lời sai chỗ không bị tính vào giới hạn
create trigger comments_check_parent
  before insert on public.comments
  for each row execute function private.comments_check_parent();

-- Bình luận gốc của truyện (p_chapter null) hoặc của một chương, kèm người viết và số trả lời.
-- INVOKER: RLS của comments và profiles áp dụng. Client thêm order và range.
create function public.comment_threads(p_story_id uuid, p_chapter integer default null)
returns table (
  id uuid,
  chapter_number integer,
  content text,
  created_at timestamptz,
  user_id uuid,
  display_name text,
  avatar_url text,
  reply_count integer
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
    (select count(*)::integer from public.comments r where r.parent_id = c.id)
  from public.comments c
  join public.profiles p on p.id = c.user_id
  where c.story_id = p_story_id
    and c.parent_id is null
    and (
      (p_chapter is null and c.chapter_number is null)
      or c.chapter_number = p_chapter
    )
$$;

-- ── 2. Báo cáo bình luận ────────────────────────────────────────────────

create type public.comment_report_reason as enum ('spam', 'offensive', 'spoiler', 'other');

-- Ở schema private: không ai đọc ghi qua API, chỉ qua report_comment và các RPC admin
create table private.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason public.comment_report_reason not null,
  note text not null default '' check (char_length(note) <= 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (reason <> 'other' or note <> '')
);
alter table private.comment_reports enable row level security;
revoke all on private.comment_reports from public, anon, authenticated;

-- Mỗi người một báo cáo đang mở cho mỗi bình luận: báo lại thì cập nhật lý do và ghi chú
create unique index comment_reports_open_unique
  on private.comment_reports (reporter_id, comment_id) where status = 'open';
create index comment_reports_comment_id_status_idx
  on private.comment_reports (comment_id, status);
create index comment_reports_reporter_id_created_at_idx
  on private.comment_reports (reporter_id, created_at desc);

-- Báo cáo bình luận của người khác trong truyện đang công khai. Tối đa 10 báo cáo mới / giờ.
create function private.report_comment(
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
  v_note text := btrim(coalesce(p_note, ''));
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  select c.user_id into v_author
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
  set reason = p_reason, note = v_note, created_at = now()
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

  insert into private.comment_reports as r (comment_id, reporter_id, reason, note)
  values (p_comment_id, v_uid, p_reason, v_note)
  on conflict (reporter_id, comment_id) where status = 'open'
  do update set reason = excluded.reason, note = excluded.note, created_at = now();
end;
$$;

create function public.report_comment(
  p_comment_id uuid,
  p_reason public.comment_report_reason,
  p_note text default ''
)
returns void
language sql
set search_path = ''
as $$
  select private.report_comment(p_comment_id, p_reason, p_note)
$$;

-- ── 3. Quản trị: xem, xóa bình luận, bỏ qua báo cáo ─────────────────────

-- p_reported = true: chỉ bình luận có báo cáo đang mở, báo cáo mới nhất trước; ngược lại: mọi
-- bình luận, mới viết trước. p_query: tìm không dấu theo nội dung hoặc tên người viết.
-- reports: các báo cáo đang mở [{reason, note, reporterName, createdAt}], mới nhất trước.
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
  last_reported_at timestamptz
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
    rp.last_reported_at
  from public.comments c
  join public.stories s on s.id = c.story_id
  join public.profiles p on p.id = c.user_id
  left join lateral (
    select
      jsonb_agg(jsonb_build_object(
        'reason', r.reason,
        'note', r.note,
        'reporterName', rep.display_name,
        'createdAt', r.created_at
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

-- Xóa bình luận của bất kỳ ai; trả lời và báo cáo của nó mất theo (khóa ngoại cascade)
create function private.admin_delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  delete from public.comments c where c.id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Đóng mọi báo cáo đang mở của một bình luận, bình luận giữ nguyên
create function private.admin_dismiss_comment_reports(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update private.comment_reports r
  set status = 'resolved', resolved_at = now()
  where r.comment_id = p_comment_id and r.status = 'open';
end;
$$;

-- ── Tổng quan: thêm số bình luận đang bị báo cáo ────────────────────────

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
      'reportedComments', (
        select count(distinct r.comment_id) from private.comment_reports r where r.status = 'open'
      ),
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

-- ── Lớp vỏ ở public ─────────────────────────────────────────────────────

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
  last_reported_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_comments(p_query, p_reported)
$$;

create function public.admin_delete_comment(p_id uuid)
returns void
language sql
set search_path = ''
as $$
  select private.admin_delete_comment(p_id)
$$;

create function public.admin_dismiss_comment_reports(p_comment_id uuid)
returns void
language sql
set search_path = ''
as $$
  select private.admin_dismiss_comment_reports(p_comment_id)
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.comments_check_parent(),
  private.report_comment(uuid, public.comment_report_reason, text),
  private.admin_comments(text, boolean),
  private.admin_delete_comment(uuid),
  private.admin_dismiss_comment_reports(uuid),
  public.comment_threads(uuid, integer),
  public.report_comment(uuid, public.comment_report_reason, text),
  public.admin_comments(text, boolean),
  public.admin_delete_comment(uuid),
  public.admin_dismiss_comment_reports(uuid)
from public, anon, authenticated;

grant execute on function public.comment_threads(uuid, integer) to anon, authenticated;

grant execute on function
  private.report_comment(uuid, public.comment_report_reason, text),
  private.admin_comments(text, boolean),
  private.admin_delete_comment(uuid),
  private.admin_dismiss_comment_reports(uuid),
  public.report_comment(uuid, public.comment_report_reason, text),
  public.admin_comments(text, boolean),
  public.admin_delete_comment(uuid),
  public.admin_dismiss_comment_reports(uuid)
to authenticated;
