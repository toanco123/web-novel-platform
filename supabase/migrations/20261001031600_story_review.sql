-- Duyệt truyện trước khi công khai (plan: documents/plan-duyet-truyen.md). Truyện của người không phải
-- quản trị viên chỉ công khai được sau khi quản trị viên duyệt; duyệt một lần là đủ (sau đó tác giả tự
-- ẩn/hiện), bị gỡ thì mất dấu đã duyệt. Tác giả gửi duyệt qua submit_story_for_review, quản trị viên
-- duyệt / từ chối qua admin_review_story. Cột duyệt không cấp quyền ghi cho tác giả.

create type public.review_status as enum ('pending', 'approved', 'rejected');

alter table public.stories
  add column review_status public.review_status,
  add column review_submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column review_reason text check (char_length(review_reason) between 1 and 500),
  -- Lý do chỉ có (và bắt buộc có) khi bị từ chối
  add constraint stories_review_reason_rejected check (
    case when review_status = 'rejected' then review_reason is not null
    else review_reason is null end
  );

-- Truyện đã từng công khai (kể cả đang tự ẩn) và không bị gỡ coi như đã duyệt. Tạm tắt trigger
-- updated_at để thứ tự khu Sáng tác (sửa gần nhất) không đổi.
alter table public.stories disable trigger stories_set_updated_at;
update public.stories
set review_status = 'approved', reviewed_at = published_at
where published_at is not null and taken_down_at is null;
alter table public.stories enable trigger stories_set_updated_at;

-- is_admin chỉ đọc JWT của chính người gọi: cho trigger và policy dưới đây gọi được
grant execute on function private.is_admin() to anon, authenticated;

-- ── Chỉ truyện đã duyệt mới công khai được; quản trị viên công khai là duyệt luôn ──

create function private.stories_require_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'published'
    and (tg_op = 'INSERT' or old.visibility is distinct from 'published')
    and new.review_status is distinct from 'approved' then
    if not private.is_admin() then
      raise exception 'story_not_approved' using errcode = 'P0001';
    end if;
    new.review_status := 'approved';
    new.reviewed_at := now();
    new.review_reason := null;
  end if;
  return new;
end;
$$;

create trigger stories_require_review
  before insert or update of visibility on public.stories
  for each row execute function private.stories_require_review();

-- ── Tác giả gửi duyệt ───────────────────────────────────────────────────

create function private.submit_story_for_review(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story public.stories%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  select * into v_story from public.stories s
  where s.id = p_story_id and s.owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_story.taken_down_at is not null then
    raise exception 'story_taken_down' using errcode = 'P0001';
  end if;
  if v_story.review_status = 'pending' then
    raise exception 'already_pending' using errcode = 'P0001';
  end if;
  if v_story.review_status = 'approved' then
    raise exception 'already_approved' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.chapters c where c.story_id = p_story_id and c.status = 'published'
  ) then
    raise exception 'no_published_chapters' using errcode = 'P0001';
  end if;

  update public.stories
  set review_status = 'pending', review_submitted_at = now(), reviewed_at = null,
    review_reason = null
  where id = p_story_id;
end;
$$;

create function public.submit_story_for_review(p_story_id uuid)
returns void
language sql
set search_path = ''
as $$
  select private.submit_story_for_review(p_story_id)
$$;

-- ── Quản trị viên duyệt / từ chối ───────────────────────────────────────

create function private.admin_review_story(p_story_id uuid, p_approve boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status public.review_status;
begin
  perform private.require_admin();
  select s.review_status into v_status from public.stories s where s.id = p_story_id for update;
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
  else
    if v_reason is null then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    update public.stories
    set review_status = 'rejected', reviewed_at = now(), review_reason = left(v_reason, 500)
    where id = p_story_id;
  end if;
end;
$$;

create function public.admin_review_story(p_story_id uuid, p_approve boolean, p_reason text)
returns void
language sql
set search_path = ''
as $$
  select private.admin_review_story(p_story_id, p_approve, p_reason)
$$;

-- ── Gỡ truyện xóa trạng thái duyệt ──────────────────────────────────────

-- p_reason null/rỗng: khôi phục (truyện vẫn là nháp; tác giả gửi duyệt lại)
create or replace function private.admin_set_story_takedown(p_story_id uuid, p_reason text)
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
    visibility = case when v_reason is null then s.visibility else 'draft' end,
    -- Gỡ thì mất dấu đã duyệt (truyện chờ duyệt cũng rời hàng chờ); khôi phục không đổi
    review_status = case when v_reason is null then s.review_status end,
    review_submitted_at = case when v_reason is null then s.review_submitted_at end,
    reviewed_at = case when v_reason is null then s.reviewed_at end,
    review_reason = case when v_reason is null then s.review_reason end
  where s.id = p_story_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ── Chương ──────────────────────────────────────────────────────────────

create or replace function private.chapters_before_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' and new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  -- Link, lịch sử đọc và bình luận của người đọc đều theo số chương
  if tg_op = 'UPDATE' and new.number <> old.number and old.published_at is not null then
    raise exception 'chapter_number_locked' using errcode = 'P0001';
  end if;

  -- Truyện đang công khai hoặc đang chờ duyệt (quản trị viên cần chương để đọc) không được mất
  -- chương công khai cuối cùng. Khi cả truyện đang bị xóa (cascade) thì dòng truyện đã mất nên
  -- điều kiện đầu sai, không chặn.
  if tg_op <> 'INSERT'
    and old.status = 'published'
    and (tg_op = 'DELETE' or new.status <> 'published')
    and exists (
      select 1 from public.stories s
      where s.id = old.story_id and (s.visibility = 'published' or s.review_status = 'pending')
    )
    and not exists (
      select 1 from public.chapters c
      where c.story_id = old.story_id and c.status = 'published' and c.id <> old.id
    ) then
    raise exception 'last_published_chapter' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ── create_story ────────────────────────────────────────────────────────

/**
 * Tạo truyện (nháp), kèm chương đầu nếu có; p_publish = true thì xuất bản chương đó, rồi tác giả
 * thì gửi duyệt truyện, quản trị viên thì công khai luôn. Tất cả trong một transaction. Slug = slugify(title), trùng thì thêm -2, -3...
 * p_first_chapter: {"number"?: int, "title": text, "content": text}
 * p_author_name: bút danh / tác giả gốc (trống: dùng tên tài khoản)
 */
create or replace function public.create_story(
  p_title text,
  p_description text,
  p_status public.story_status,
  p_genres text[],
  p_cover_path text default null,
  p_first_chapter jsonb default null,
  p_publish boolean default false,
  p_author_name text default null
)
returns setof public.studio_stories
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_id uuid;
  v_try integer := 1;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  v_base := rtrim(left(coalesce(nullif(public.slugify(p_title), ''), 'truyen'), 120), '-');
  loop
    v_slug := case when v_try = 1 then v_base else v_base || '-' || v_try end;
    begin
      insert into public.stories (slug, title, description, status, cover_path, author_name)
      values (
        v_slug,
        btrim(regexp_replace(p_title, '\s+', ' ', 'g')),
        btrim(coalesce(p_description, '')),
        p_status,
        p_cover_path,
        nullif(btrim(regexp_replace(coalesce(p_author_name, ''), '\s+', ' ', 'g')), '')
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 100 then
        raise;
      end if;
    end;
  end loop;

  -- Thể loại giữ thứ tự tác giả chọn, bỏ trùng
  insert into public.story_genres (story_id, genre_slug, position)
  select v_id, t.slug, (row_number() over (order by min(t.ord)) - 1)::smallint
  from unnest(coalesce(p_genres, '{}'::text[])) with ordinality as t(slug, ord)
  group by t.slug;

  if p_first_chapter is not null then
    insert into public.chapters (story_id, number, title, content, status)
    values (
      v_id,
      coalesce((p_first_chapter ->> 'number')::integer, 1),
      btrim(coalesce(p_first_chapter ->> 'title', '')),
      btrim(p_first_chapter ->> 'content'),
      case when p_publish then 'published' else 'draft' end::public.publication_status
    );
    if p_publish then
      if private.is_admin() then
        update public.stories set visibility = 'published' where id = v_id;
      else
        -- Tác giả: chương đầu đã xuất bản, truyện vào hàng chờ duyệt
        perform private.submit_story_for_review(v_id);
      end if;
    end if;
  end if;

  return query select * from public.studio_stories ss where ss.id = v_id;
end;
$$;

-- ── Khu Sáng tác thấy trạng thái duyệt và lý do từ chối ─────────────────

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
  s.takedown_reason,
  s.author_name,
  s.review_status,
  s.review_submitted_at,
  s.reviewed_at,
  s.review_reason
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

-- ── RLS: quản trị viên đọc được truyện chờ duyệt và chương đã xuất bản của nó ──

alter policy stories_select_visible on public.stories
  using (
    visibility = 'published'
    or owner_id = (select auth.uid())
    or (review_status = 'pending' and (select private.is_admin()))
  );

alter policy chapters_select_visible on public.chapters
  using (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id
      and (
        (s.visibility = 'published' and chapters.status = 'published')
        or s.owner_id = (select auth.uid())
        or (s.review_status = 'pending' and chapters.status = 'published'
          and (select private.is_admin()))
      )
  ));

-- ── admin_stories: thêm bút danh, thể loại và trạng thái duyệt (hàng chờ dùng chung hàm này) ──

drop function public.admin_stories(text, public.publication_status, uuid, text);
drop function private.admin_stories(text, public.publication_status, uuid, text);

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
  takedown_reason text,
  author_name text,
  genre_slugs text[],
  review_status public.review_status,
  review_submitted_at timestamptz,
  reviewed_at timestamptz,
  review_reason text
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
    s.takedown_reason,
    s.author_name,
    coalesce((
      select array_agg(sg.genre_slug order by sg.position, sg.genre_slug)
      from public.story_genres sg
      where sg.story_id = s.id
    ), '{}'::text[]),
    s.review_status,
    s.review_submitted_at,
    s.reviewed_at,
    s.review_reason
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
  takedown_reason text,
  author_name text,
  genre_slugs text[],
  review_status public.review_status,
  review_submitted_at timestamptz,
  reviewed_at timestamptz,
  review_reason text
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_stories(p_query, p_visibility, p_owner_id, p_sort)
$$;

-- ── Tổng quan: số truyện chờ duyệt ──────────────────────────────────────

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
      'bannedUsers', (select count(*) from auth.users u where u.banned_until > now()),
      'pendingReviews',
        (select count(*) from public.stories s where s.review_status = 'pending')
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

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.stories_require_review(),
  private.submit_story_for_review(uuid),
  private.admin_review_story(uuid, boolean, text),
  private.admin_stories(text, public.publication_status, uuid, text),
  public.submit_story_for_review(uuid),
  public.admin_review_story(uuid, boolean, text),
  public.admin_stories(text, public.publication_status, uuid, text)
from public, anon, authenticated;

grant execute on function
  private.submit_story_for_review(uuid),
  private.admin_review_story(uuid, boolean, text),
  private.admin_stories(text, public.publication_status, uuid, text),
  public.submit_story_for_review(uuid),
  public.admin_review_story(uuid, boolean, text),
  public.admin_stories(text, public.publication_status, uuid, text)
to authenticated;
