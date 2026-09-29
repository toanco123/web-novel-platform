-- Công cụ admin, phần 4: tên tác giả gốc / bút danh cho truyện (plan: documents/plan-cong-cu-admin.md).
-- Truyện nhập hàng loạt đứng tên tài khoản admin nhưng hiển thị tác giả thật. Mọi tác giả cũng đặt được
-- bút danh trong form truyện. Trống thì hiển thị tên tài khoản như trước.

alter table public.stories
  add column author_name text check (author_name is null or char_length(author_name) between 1 and 60);

grant insert (author_name), update (author_name) on public.stories to authenticated;

-- Tác giả hiển thị: bút danh nếu có, không thì tên tài khoản
create or replace view public.story_cards
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
  coalesce(s.author_name, p.display_name) as author_name,
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
  greatest(st.last_chapter_at, s.published_at, s.created_at) as updated_at,
  -- Truyện cùng chủ và cùng bút danh là "cùng tác giả" (null: không đặt bút danh)
  public.slugify(s.author_name) as author_key
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

-- Form truyện điền sẵn bút danh
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
  s.author_name
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

-- Tìm theo cả bút danh
/**
 * Tìm truyện công khai theo tên hoặc tác giả, không phân biệt dấu. Điểm giống matchScore:
 * 4 tên bắt đầu bằng từ khóa, 3 tên chứa từ khóa, 2 tên chứa đủ các từ, 1 tên tác giả chứa từ khóa.
 */
create or replace function public.search_stories(p_query text)
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
      when strpos(public.slugify(coalesce(s.author_name, p.display_name)), q.q) > 0 then 1
      else 0
    end as score
  ) sc
  where q.q <> ''
    and s.visibility = 'published'
    and st.chapter_count > 0
    and sc.score > 0
  order by sc.score desc, st.view_count desc
$$;

-- ── create_story / update_story nhận thêm bút danh ──────────────────────

drop function public.create_story(text, text, public.story_status, text[], text, jsonb, boolean);
drop function public.update_story(uuid, text, text, public.story_status, text[], text);

/**
 * Tạo truyện (nháp), kèm chương đầu nếu có; p_publish = true thì xuất bản chương đó và công khai
 * truyện luôn. Tất cả trong một transaction. Slug = slugify(title), trùng thì thêm -2, -3...
 * p_first_chapter: {"number"?: int, "title": text, "content": text}
 * p_author_name: bút danh / tác giả gốc (trống: dùng tên tài khoản)
 */
create function public.create_story(
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
  p_cover_path text default null,
  p_author_name text default null
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
    cover_path = p_cover_path,
    author_name = nullif(btrim(regexp_replace(coalesce(p_author_name, ''), '\s+', ' ', 'g')), '')
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

revoke execute on function
  public.create_story(text, text, public.story_status, text[], text, jsonb, boolean, text),
  public.update_story(uuid, text, text, public.story_status, text[], text, text)
from public, anon, authenticated;

grant execute on function
  public.create_story(text, text, public.story_status, text[], text, jsonb, boolean, text),
  public.update_story(uuid, text, text, public.story_status, text[], text, text)
to authenticated;
