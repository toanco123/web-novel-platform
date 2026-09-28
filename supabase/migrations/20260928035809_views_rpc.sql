-- View và RPC cho các api.ts. View dùng security_invoker nên RLS của bảng gốc vẫn áp dụng.
-- RPC mặc định SECURITY INVOKER; riêng record_chapter_view là DEFINER (khách cũng ghi được lượt đọc).

-- ── View ────────────────────────────────────────────────────────────────

-- Một truyện dạng thẻ, map thẳng ra kiểu Story. created_at/updated_at ở đây là mốc người đọc thấy:
-- lần đầu công khai và lần xuất bản chương gần nhất.
-- Danh sách công khai lọc thêm: visibility = 'published' and chapter_count > 0.
create view public.story_cards
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.description,
  s.status,
  s.visibility,
  s.owner_id,
  p.display_name as author_name,
  s.cover_path,
  coalesce(g.genres, '[]'::jsonb) as genres,
  coalesce(g.genre_slugs, '{}'::text[]) as genre_slugs,
  st.chapter_count,
  st.first_chapter_number,
  st.latest_chapter_number,
  st.latest_chapter_title,
  st.view_count,
  st.follower_count,
  st.rating_count,
  st.rating_avg,
  st.rating_counts,
  coalesce(s.published_at, s.created_at) as created_at,
  greatest(st.last_chapter_at, s.published_at, s.created_at) as updated_at
from public.stories s
join public.profiles p on p.id = s.owner_id
join public.story_stats st on st.story_id = s.id
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object('slug', gg.slug, 'name', gg.name, 'description', gg.description)
      order by sg.position, gg.name
    ) as genres,
    array_agg(gg.slug order by sg.position, gg.name) as genre_slugs
  from public.story_genres sg
  join public.genres gg on gg.slug = sg.genre_slug
  where sg.story_id = s.id
) g on true;

-- Truyện của người đang đăng nhập cho khu Sáng tác (kiểu MyStory)
create view public.studio_stories
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
  coalesce(rp.open_reports, 0) as open_reports
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

-- Thể loại kèm số truyện công khai (getGenres)
create view public.genre_cards
with (security_invoker = true)
as
select
  g.slug,
  g.name,
  g.description,
  g.created_by,
  p.display_name as created_by_name,
  g.created_at,
  (
    select count(*)::integer
    from public.story_genres sg
    join public.stories s on s.id = sg.story_id
    join public.story_stats st on st.story_id = s.id
    where sg.genre_slug = g.slug and s.visibility = 'published' and st.chapter_count > 0
  ) as story_count
from public.genres g
left join public.profiles p on p.id = g.created_by;

revoke all on public.story_cards, public.studio_stories, public.genre_cards from anon, authenticated;
grant select on public.story_cards, public.genre_cards to anon, authenticated;
grant select on public.studio_stories to authenticated;

-- ── Sáng tác ────────────────────────────────────────────────────────────

/**
 * Tạo truyện (nháp), kèm chương đầu nếu có; p_publish = true thì xuất bản chương đó và công khai
 * truyện luôn. Tất cả trong một transaction. Slug = slugify(title), trùng thì thêm -2, -3...
 * p_first_chapter: {"number"?: int, "title": text, "content": text}
 */
create function public.create_story(
  p_title text,
  p_description text,
  p_status public.story_status,
  p_genres text[],
  p_cover_path text default null,
  p_first_chapter jsonb default null,
  p_publish boolean default false
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
      insert into public.stories (slug, title, description, status, cover_path)
      values (
        v_slug,
        btrim(regexp_replace(p_title, '\s+', ' ', 'g')),
        btrim(coalesce(p_description, '')),
        p_status,
        p_cover_path
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
      update public.stories set visibility = 'published' where id = v_id;
    end if;
  end if;

  return query select * from public.studio_stories ss where ss.id = v_id;
end;
$$;

-- Sửa thông tin truyện và thay thể loại cùng lúc
create function public.update_story(
  p_id uuid,
  p_title text,
  p_description text,
  p_status public.story_status,
  p_genres text[],
  p_cover_path text default null
)
returns setof public.studio_stories
language plpgsql
set search_path = ''
as $$
begin
  update public.stories
  set
    title = btrim(regexp_replace(p_title, '\s+', ' ', 'g')),
    description = btrim(coalesce(p_description, '')),
    status = p_status,
    cover_path = p_cover_path
  where id = p_id and owner_id = (select auth.uid());
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  delete from public.story_genres where story_id = p_id;
  insert into public.story_genres (story_id, genre_slug, position)
  select p_id, t.slug, (row_number() over (order by min(t.ord)) - 1)::smallint
  from unnest(coalesce(p_genres, '{}'::text[])) with ordinality as t(slug, ord)
  group by t.slug;

  return query select * from public.studio_stories ss where ss.id = p_id;
end;
$$;

-- Số liệu cho tab Thống kê (kiểu StoryStats); chỉ chủ truyện xem được
create function public.studio_story_stats(p_story_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.stories s where s.id = p_story_id and s.owner_id = (select auth.uid())
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'views', st.view_count,
    'viewsRecent', (
      select coalesce(sum(v.views), 0)
      from public.chapter_views v
      where v.story_id = p_story_id and v.day > v_today - 7
    ),
    'viewsByDay', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'views', coalesce(v.views, 0)) order by d.day)
      from (select v_today - i as day from generate_series(6, 0, -1) as i) d
      left join lateral (
        select sum(cv.views) as views
        from public.chapter_views cv
        where cv.story_id = p_story_id and cv.day = d.day
      ) v on true
    ),
    'viewsByChapter', (
      select coalesce(jsonb_agg(
        jsonb_build_object('number', c.number, 'title', c.title, 'views', coalesce(v.views, 0))
        order by c.number
      ), '[]'::jsonb)
      from public.chapters c
      left join lateral (
        select sum(cv.views) as views
        from public.chapter_views cv
        where cv.story_id = c.story_id and cv.chapter_number = c.number
      ) v on true
      where c.story_id = p_story_id and c.status = 'published'
    ),
    'followers', st.follower_count,
    'ratingAvg', st.rating_avg,
    'ratingCount', st.rating_count,
    'comments', (select count(*) from public.comments cm where cm.story_id = p_story_id)
  )
  into v_result
  from public.story_stats st
  where st.story_id = p_story_id;

  return v_result;
end;
$$;

-- ── Người đọc ───────────────────────────────────────────────────────────

-- Ghi 1 lượt đọc chương đã xuất bản; không tính lượt của chính tác giả. DEFINER vì khách cũng ghi
-- được mà không được phép sửa thẳng bảng số liệu. Chống đếm trùng hiện nằm ở client.
create function public.record_chapter_view(p_slug text, p_number integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
begin
  select s.id into v_story_id
  from public.stories s
  join public.chapters c on c.story_id = s.id
  where s.slug = p_slug
    and s.visibility = 'published'
    and s.owner_id is distinct from (select auth.uid())
    and c.number = p_number
    and c.status = 'published';
  if v_story_id is null then
    return;
  end if;

  insert into public.chapter_views as cv (story_id, chapter_number, day, views)
  values (v_story_id, p_number, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 1)
  on conflict (story_id, chapter_number, day) do update set views = cv.views + 1;

  update public.story_stats set view_count = view_count + 1 where story_id = v_story_id;
end;
$$;

/**
 * Ghi chỗ đang đọc (mở chương hoặc cuộn). p_progress = null: giữ vị trí cũ nếu vẫn chương đó.
 * Trigger reading_history_bump_seen nâng mốc "đã thấy" nếu đang theo dõi truyện.
 */
create function public.save_reading_progress(
  p_slug text,
  p_chapter integer,
  p_chapter_title text,
  p_progress real default null
)
returns public.reading_history
language plpgsql
set search_path = ''
as $$
declare
  v_story_id uuid;
  v_row public.reading_history;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  select s.id into v_story_id from public.stories s where s.slug = p_slug;
  if v_story_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.reading_history as h (story_id, chapter_number, chapter_title, progress, read_at)
  values (
    v_story_id,
    p_chapter,
    left(coalesce(p_chapter_title, ''), 120),
    least(1, greatest(0, coalesce(p_progress, 0))),
    now()
  )
  on conflict (user_id, story_id) do update set
    chapter_number = excluded.chapter_number,
    chapter_title = excluded.chapter_title,
    progress = case
      when p_progress is null and h.chapter_number = excluded.chapter_number then h.progress
      else excluded.progress
    end,
    read_at = excluded.read_at
  returning * into v_row;

  return v_row;
end;
$$;

/**
 * Gộp lịch sử đọc lúc còn là khách (localStorage) vào tài khoản ở lần đầu đăng nhập.
 * p_entries: [{"slug", "chapter", "chapterTitle", "progress", "readAt"}]; mỗi truyện giữ bản mới hơn.
 */
create function public.merge_guest_history(p_entries jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  insert into public.reading_history as h (story_id, chapter_number, chapter_title, progress, read_at)
  select distinct on (s.id)
    s.id,
    (e ->> 'chapter')::integer,
    left(coalesce(e ->> 'chapterTitle', ''), 120),
    least(1, greatest(0, coalesce((e ->> 'progress')::real, 0))),
    least(coalesce((e ->> 'readAt')::timestamptz, now()), now())
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
  join public.stories s on s.slug = e ->> 'slug'
  where (e ->> 'chapter')::integer between 1 and 99999
  order by s.id, (e ->> 'readAt')::timestamptz desc nulls last
  on conflict (user_id, story_id) do update set
    chapter_number = excluded.chapter_number,
    chapter_title = excluded.chapter_title,
    progress = excluded.progress,
    read_at = excluded.read_at
  where excluded.read_at > h.read_at;
end;
$$;

/**
 * Truyện đang theo dõi kèm số chương mới; truyện có chương mới lên đầu, rồi truyện mới cập nhật.
 * Truyện đã bị ẩn (người khác) không hiện vì RLS của stories.
 */
create function public.get_library()
returns table (
  story_id uuid,
  slug text,
  followed_at timestamptz,
  seen_chapter integer,
  new_chapters integer
)
language sql
stable
set search_path = ''
as $$
  select
    f.story_id,
    s.slug,
    f.followed_at,
    f.seen_chapter,
    n.new_chapters
  from public.follows f
  join public.stories s on s.id = f.story_id
  join public.story_stats st on st.story_id = s.id
  cross join lateral (
    select count(*)::integer as new_chapters
    from public.chapters c
    where c.story_id = f.story_id and c.status = 'published' and c.number > f.seen_chapter
  ) n
  where f.user_id = (select auth.uid())
  order by
    (n.new_chapters > 0) desc,
    greatest(st.last_chapter_at, s.published_at, s.created_at) desc
$$;

-- Số truyện đang theo dõi có chương mới (chấm trên avatar)
create function public.library_update_count()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer from public.get_library() l where l.new_chapters > 0
$$;

-- Báo lỗi chương; báo lại cùng lý do khi báo lỗi cũ chưa xử lý thì chỉ cập nhật ghi chú
create function public.report_chapter(
  p_slug text,
  p_chapter integer,
  p_reason public.report_reason,
  p_note text default ''
)
returns public.chapter_reports
language plpgsql
set search_path = ''
as $$
declare
  v_story_id uuid;
  v_row public.chapter_reports;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  select s.id into v_story_id from public.stories s where s.slug = p_slug;
  if v_story_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.chapter_reports as r (story_id, chapter_number, reason, note)
  values (v_story_id, p_chapter, p_reason, btrim(coalesce(p_note, '')))
  on conflict (reporter_id, story_id, chapter_number, reason) where status = 'open'
  do update set note = excluded.note, created_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- ── Danh sách ───────────────────────────────────────────────────────────

/**
 * Tìm truyện công khai theo tên hoặc tác giả, không phân biệt dấu. Điểm giống matchScore:
 * 4 tên bắt đầu bằng từ khóa, 3 tên chứa từ khóa, 2 tên chứa đủ các từ, 1 tên tác giả chứa từ khóa.
 */
create function public.search_stories(p_query text)
returns table (story_id uuid, score integer, view_count bigint)
language sql
stable
set search_path = ''
as $$
  with q as (select public.slugify(coalesce(p_query, '')) as q)
  select s.id, sc.score, st.view_count
  from q
  cross join public.stories s
  join public.story_stats st on st.story_id = s.id
  join public.profiles p on p.id = s.owner_id
  cross join lateral (
    select case
      when s.search_title like q.q || '%' then 4
      when strpos(s.search_title, q.q) > 0 then 3
      when (
        select bool_and(strpos(s.search_title, w) > 0)
        from unnest(string_to_array(q.q, '-')) as w
      ) then 2
      when strpos(public.slugify(p.display_name), q.q) > 0 then 1
      else 0
    end as score
  ) sc
  where q.q <> ''
    and s.visibility = 'published'
    and st.chapter_count > 0
    and sc.score > 0
  order by sc.score desc, st.view_count desc
$$;

/**
 * Bảng xếp hạng truyện công khai.
 * p_by: views | rating | follows; p_period (chỉ với views): week (7 ngày) | month (30 ngày) | all.
 * rating xếp theo điểm có trọng số với 50 lượt chấm "ảo" bằng điểm trung bình chung (RATING_PRIOR),
 * còn value trả về là điểm trung bình thật.
 */
create function public.story_ranking(
  p_by text default 'views',
  p_period text default 'week',
  p_limit integer default 50
)
returns table (story_id uuid, value numeric)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_by = 'rating' then
    return query
    with rated as (
      select st.story_id as sid, st.rating_avg, st.rating_sum, st.rating_count
      from public.stories s
      join public.story_stats st on st.story_id = s.id
      where s.visibility = 'published' and st.chapter_count > 0 and st.rating_count > 0
    ),
    base as (select coalesce(avg(rated.rating_avg), 0) as mean from rated)
    select rated.sid, rated.rating_avg::numeric
    from rated, base
    order by (rated.rating_sum + base.mean * 50) / (rated.rating_count + 50) desc
    limit v_limit;

  elsif p_by = 'follows' then
    return query
    select st.story_id, st.follower_count::numeric
    from public.stories s
    join public.story_stats st on st.story_id = s.id
    where s.visibility = 'published' and st.chapter_count > 0 and st.follower_count > 0
    order by st.follower_count desc
    limit v_limit;

  elsif p_by = 'views' and p_period = 'all' then
    return query
    select st.story_id, st.view_count::numeric
    from public.stories s
    join public.story_stats st on st.story_id = s.id
    where s.visibility = 'published' and st.chapter_count > 0 and st.view_count > 0
    order by st.view_count desc
    limit v_limit;

  elsif p_by = 'views' and p_period in ('week', 'month') then
    return query
    select v.story_id, sum(v.views)::numeric
    from public.chapter_views v
    join public.stories s on s.id = v.story_id
    join public.story_stats st on st.story_id = s.id
    where v.day > v_today - case when p_period = 'week' then 7 else 30 end
      and s.visibility = 'published'
      and st.chapter_count > 0
    group by v.story_id
    order by sum(v.views) desc
    limit v_limit;

  else
    raise exception 'invalid_ranking' using errcode = 'P0001';
  end if;
end;
$$;

-- Truyện liên quan: nhiều thể loại trùng nhất, rồi nhiều lượt đọc nhất; bỏ truyện cùng tác giả
create function public.related_stories(p_slug text, p_limit integer default 6)
returns table (story_id uuid, overlap integer)
language sql
stable
set search_path = ''
as $$
  select s.id, count(*)::integer
  from public.stories me
  join public.story_genres mine on mine.story_id = me.id
  join public.story_genres other on other.genre_slug = mine.genre_slug and other.story_id <> me.id
  join public.stories s on s.id = other.story_id
  join public.story_stats st on st.story_id = s.id
  where me.slug = p_slug
    and s.owner_id <> me.owner_id
    and s.visibility = 'published'
    and st.chapter_count > 0
  group by s.id, st.view_count
  order by count(*) desc, st.view_count desc
  limit least(greatest(coalesce(p_limit, 6), 1), 50)
$$;

-- ── Quyền thực thi ──────────────────────────────────────────────────────

revoke execute on function
  public.create_story(text, text, public.story_status, text[], text, jsonb, boolean),
  public.update_story(uuid, text, text, public.story_status, text[], text),
  public.studio_story_stats(uuid),
  public.record_chapter_view(text, integer),
  public.save_reading_progress(text, integer, text, real),
  public.merge_guest_history(jsonb),
  public.get_library(),
  public.library_update_count(),
  public.report_chapter(text, integer, public.report_reason, text),
  public.search_stories(text),
  public.story_ranking(text, text, integer),
  public.related_stories(text, integer)
from public, anon, authenticated;

grant execute on function
  public.record_chapter_view(text, integer),
  public.search_stories(text),
  public.story_ranking(text, text, integer),
  public.related_stories(text, integer)
to anon, authenticated;

grant execute on function
  public.create_story(text, text, public.story_status, text[], text, jsonb, boolean),
  public.update_story(uuid, text, text, public.story_status, text[], text),
  public.studio_story_stats(uuid),
  public.save_reading_progress(text, integer, text, real),
  public.merge_guest_history(jsonb),
  public.get_library(),
  public.library_update_count(),
  public.report_chapter(text, integer, public.report_reason, text)
to authenticated;
