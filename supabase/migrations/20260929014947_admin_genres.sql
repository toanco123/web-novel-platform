-- Công cụ admin, phần 3: quản lý thể loại (plan: documents/plan-cong-cu-admin.md).
-- Bảng genres không có policy sửa/xóa cho ai; admin làm qua các RPC dưới (DEFINER ở private).
-- Đổi tên thì slug đổi theo (= slugify(tên) như lúc tạo); story_genres cập nhật theo nhờ khóa ngoại
-- on update cascade. Trùng tên (theo slug) với thể loại khác thì báo genre_exists.

create function private.admin_update_genre(p_slug text, p_name text, p_description text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_slug text := public.slugify(v_name);
  v_row public.genres;
begin
  perform private.require_admin();
  if exists (select 1 from public.genres g where g.slug = v_slug and g.slug <> p_slug) then
    raise exception 'genre_exists' using errcode = 'P0001';
  end if;
  update public.genres g
  set name = v_name, slug = v_slug, description = nullif(btrim(p_description), '')
  where g.slug = p_slug
  returning * into v_row;
  if v_row.slug is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return jsonb_build_object('slug', v_row.slug, 'name', v_row.name, 'description', v_row.description);
end;
$$;

-- Truyện đang dùng thể loại này mất thể loại đó (story_genres xóa theo)
create function private.admin_delete_genre(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  delete from public.genres g where g.slug = p_slug;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Gộp p_from vào p_into: truyện của p_from chuyển sang p_into (giữ vị trí, bỏ trùng), rồi xóa p_from.
-- Xóa trước rồi mới thêm để không vướng giới hạn 5 thể loại / truyện. Trả về số truyện được chuyển.
create function private.admin_merge_genres(p_from text, p_into text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_ids uuid[];
  v_positions smallint[];
  v_moved integer;
begin
  perform private.require_admin();
  if p_from = p_into then
    raise exception 'same_genre' using errcode = 'P0001';
  end if;
  if (select count(*) from public.genres g where g.slug in (p_from, p_into)) < 2 then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

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
  return v_moved;
end;
$$;

-- ── Lớp vỏ ở public ─────────────────────────────────────────────────────

create function public.admin_update_genre(p_slug text, p_name text, p_description text)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_update_genre(p_slug, p_name, p_description)
$$;

create function public.admin_delete_genre(p_slug text)
returns void
language sql
set search_path = ''
as $$
  select private.admin_delete_genre(p_slug)
$$;

create function public.admin_merge_genres(p_from text, p_into text)
returns integer
language sql
set search_path = ''
as $$
  select private.admin_merge_genres(p_from, p_into)
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.admin_update_genre(text, text, text),
  private.admin_delete_genre(text),
  private.admin_merge_genres(text, text),
  public.admin_update_genre(text, text, text),
  public.admin_delete_genre(text),
  public.admin_merge_genres(text, text)
from public, anon, authenticated;

grant execute on function
  private.admin_update_genre(text, text, text),
  private.admin_delete_genre(text),
  private.admin_merge_genres(text, text),
  public.admin_update_genre(text, text, text),
  public.admin_delete_genre(text),
  public.admin_merge_genres(text, text)
to authenticated;
