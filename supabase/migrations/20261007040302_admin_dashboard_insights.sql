-- Dashboard quản trị: so với kỳ trước, bình luận và theo dõi theo ngày, lịch nhiệt lượt đọc,
-- lượt đọc theo thể loại, tác giả nổi bật (plan: documents/plan-trang-quan-tri.md).
-- Hàm giữ nguyên chữ ký nên grant cũ của private/public.admin_overview vẫn còn.

-- ── 1. Index cho đếm theo ngày ───────────────────────────────────────────
-- Tổng quan đếm bình luận và lượt theo dõi theo mốc thời gian; chưa có index nên phải quét cả bảng
create index comments_created_at_idx on public.comments (created_at);
create index follows_followed_at_idx on public.follows (followed_at);

-- ── 2. admin_overview ────────────────────────────────────────────────────
-- Thêm so với kỳ trước (cùng số ngày), bình luận/theo dõi theo ngày, lịch nhiệt 12 tuần (từ thứ
-- Hai), lượt đọc theo thể loại, tác giả nổi bật. Các key cũ giữ nguyên. Mọi chuỗi theo ngày đếm một
-- lần trên cửa sổ bao trùm kỳ này, kỳ trước và lịch nhiệt (CTE daily)
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
  v_prev_from date := v_from - v_days;
  -- Lịch nhiệt: 12 cột tuần, cột đầu bắt đầu thứ Hai của 11 tuần trước
  v_cal_from date := date_trunc('week', v_today::timestamp)::date - 77;
  v_win_from date := least(v_prev_from, v_cal_from);
  v_win_start timestamptz := v_win_from::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_result jsonb;
begin
  perform private.require_admin();

  with days as (
    select v_win_from + i as day from generate_series(0, v_today - v_win_from) as i
  ),
  signups as (
    select (u.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from auth.users u
    where u.created_at >= v_win_start
    group by 1
  ),
  views as (
    select v.day, sum(v.views) as n
    from public.chapter_views v
    where v.day >= v_win_from
    group by 1
  ),
  new_stories as (
    select (s.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from public.stories s
    where s.created_at >= v_win_start
    group by 1
  ),
  new_chapters as (
    select (c.published_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from public.chapters c
    where c.published_at >= v_win_start
    group by 1
  ),
  new_comments as (
    select (c.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from public.comments c
    where c.created_at >= v_win_start
    group by 1
  ),
  new_follows as (
    select (f.followed_at at time zone 'Asia/Ho_Chi_Minh')::date as day, count(*) as n
    from public.follows f
    where f.followed_at >= v_win_start
    group by 1
  ),
  daily as (
    select d.day,
      coalesce(su.n, 0) as signups,
      coalesce(vw.n, 0) as views,
      coalesce(ns.n, 0) as stories,
      coalesce(nc.n, 0) as chapters,
      coalesce(cm.n, 0) as comments,
      coalesce(fo.n, 0) as follows
    from days d
    left join signups su on su.day = d.day
    left join views vw on vw.day = d.day
    left join new_stories ns on ns.day = d.day
    left join new_chapters nc on nc.day = d.day
    left join new_comments cm on cm.day = d.day
    left join new_follows fo on fo.day = d.day
  ),
  -- Lượt đọc trong kỳ của từng truyện (thể loại, tác giả)
  story_views as (
    select v.story_id, sum(v.views) as n
    from public.chapter_views v
    where v.day >= v_from
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
      -- daily trải cả kỳ trước: chỉ cộng kỳ đang xem
      'viewsInPeriod', (select coalesce(sum(d.views), 0) from daily d where d.day >= v_from),
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
        'day', c.day,
        'signups', c.signups,
        'views', c.views,
        'stories', c.stories,
        'chapters', c.chapters,
        'comments', c.comments,
        'follows', c.follows,
        'viewsPrev', coalesce(p.views, 0)
      ) order by c.day)
      from daily c
      left join daily p on p.day = c.day - v_days
      where c.day >= v_from
    ),
    'current', (
      select jsonb_build_object(
        'signups', coalesce(sum(d.signups), 0),
        'views', coalesce(sum(d.views), 0),
        'stories', coalesce(sum(d.stories), 0),
        'chapters', coalesce(sum(d.chapters), 0),
        'comments', coalesce(sum(d.comments), 0),
        'follows', coalesce(sum(d.follows), 0)
      )
      from daily d
      where d.day >= v_from
    ),
    'previous', (
      select jsonb_build_object(
        'signups', coalesce(sum(d.signups), 0),
        'views', coalesce(sum(d.views), 0),
        'stories', coalesce(sum(d.stories), 0),
        'chapters', coalesce(sum(d.chapters), 0),
        'comments', coalesce(sum(d.comments), 0),
        'follows', coalesce(sum(d.follows), 0)
      )
      from daily d
      where d.day >= v_prev_from and d.day < v_from
    ),
    'calendar', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'views', d.views) order by d.day)
      from daily d
      where d.day >= v_cal_from
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
    -- Truyện nhiều thể loại tính vào từng thể loại (tổng các mục lớn hơn lượt đọc trong kỳ)
    'genreViews', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'views', t.n)
        order by t.n desc, t.name), '[]'::jsonb)
      from (
        select g.name, sum(sv.n) as n
        from story_views sv
        join public.story_genres sg on sg.story_id = sv.story_id
        join public.genres g on g.slug = sg.genre_slug
        group by g.slug, g.name
        order by n desc, g.name
        limit 10
      ) t
    ),
    -- Tác giả = chủ truyện + bút danh (như "cùng tác giả", author_key của story_cards)
    'topAuthors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', t.owner_id::text || ':' || coalesce(t.author_key, ''),
        'ownerId', t.owner_id,
        'name', t.name,
        'stories', t.stories,
        'views', t.views,
        'followers', t.followers
      ) order by t.views desc, t.name), '[]'::jsonb)
      from (
        select s.owner_id,
          public.slugify(s.author_name) as author_key,
          min(coalesce(s.author_name, p.display_name)) as name,
          count(*) filter (where s.visibility = 'published') as stories,
          coalesce(sum(sv.n), 0) as views,
          coalesce(sum(st.follower_count), 0) as followers
        from public.stories s
        join public.profiles p on p.id = s.owner_id
        join public.story_stats st on st.story_id = s.id
        left join story_views sv on sv.story_id = s.id
        group by s.owner_id, public.slugify(s.author_name)
        having coalesce(sum(sv.n), 0) > 0
        order by views desc, name
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
        -- Bút danh trước, không có thì tên tài khoản (như story_cards)
        select s.id, s.slug, s.title, s.visibility,
          coalesce(s.author_name, p.display_name) as author_name,
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
