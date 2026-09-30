-- Chọn truyện cho trang chủ trong khu Quản trị (trước đây sửa bảng curated_stories qua Dashboard).
-- Bảng không có quyền ghi cho ai; quản trị viên ghi qua RPC dưới (DEFINER ở private).
-- Danh sách trống thì trang chủ tự chọn (getFeaturedStories / getEditorPicks ở client).

-- Danh sách đã chọn theo thứ tự, kể cả truyện đang ẩn hoặc bị gỡ (để admin thấy và bỏ đi)
create function private.admin_curated(p_list text)
returns table (story_id uuid, slug text, title text, author_name text, is_public boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();

  return query
  select
    s.id,
    s.slug,
    s.title,
    coalesce(s.author_name, p.display_name),
    s.visibility = 'published' and st.chapter_count > 0
  from public.curated_stories c
  join public.stories s on s.id = c.story_id
  join public.story_stats st on st.story_id = s.id
  join public.profiles p on p.id = s.owner_id
  where c.list = p_list
  order by c.position, c.story_id;
end;
$$;

-- Thay cả danh sách theo thứ tự của p_story_ids (id lặp lại chỉ giữ lần đầu). Tối đa 8 truyện nổi
-- bật, 12 truyện đề cử (CURATED_LIMITS ở features/admin/shared.ts).
create function private.admin_set_curated(p_list text, p_story_ids uuid[])
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
end;
$$;

-- ── Lớp vỏ ở public ─────────────────────────────────────────────────────

create function public.admin_curated(p_list text)
returns table (story_id uuid, slug text, title text, author_name text, is_public boolean)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_curated(p_list)
$$;

create function public.admin_set_curated(p_list text, p_story_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  select private.admin_set_curated(p_list, p_story_ids)
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.admin_curated(text),
  private.admin_set_curated(text, uuid[]),
  public.admin_curated(text),
  public.admin_set_curated(text, uuid[])
from public, anon, authenticated;

grant execute on function
  private.admin_curated(text),
  private.admin_set_curated(text, uuid[]),
  public.admin_curated(text),
  public.admin_set_curated(text, uuid[])
to authenticated;
