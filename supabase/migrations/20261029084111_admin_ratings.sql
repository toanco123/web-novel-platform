-- Quản trị xem và xóa điểm chấm (plan documents/plan-admin-phieu-va-danh-gia.md, mục 2).
-- ratings chỉ cho chủ đọc nên các hàm đều DEFINER và tự kiểm tra quản trị viên.

-- ── 1. Danh sách điểm chấm ──────────────────────────────────────────────
-- user_rating_count / user_rating_avg: tính trên mọi điểm người đó đã chấm (không bị bộ lọc tìm kiếm
-- thu hẹp), để thấy ngay tài khoản chấm hàng loạt hay chấm 1 sao.
create function private.admin_ratings(p_query text)
returns table (
  user_id uuid,
  user_name text,
  user_email text,
  story_id uuid,
  story_slug text,
  story_title text,
  score integer,
  created_at timestamptz,
  user_rating_count integer,
  user_rating_avg numeric
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
  with per_rating as (
    select
      r.user_id,
      r.story_id,
      r.score,
      r.updated_at,
      (count(*) over (partition by r.user_id))::integer as n,
      round(avg(r.score) over (partition by r.user_id), 2) as mean
    from public.ratings r
  )
  select
    pr.user_id,
    coalesce(p.display_name, ''),
    u.email::text,
    s.id,
    s.slug,
    s.title,
    pr.score::integer,
    pr.updated_at,
    pr.n,
    pr.mean
  from per_rating pr
  join public.stories s on s.id = pr.story_id
  left join public.profiles p on p.id = pr.user_id
  left join auth.users u on u.id = pr.user_id
  where v_q = ''
    or strpos(public.slugify(s.title), v_q) > 0
    or strpos(public.slugify(coalesce(p.display_name, '')), v_q) > 0
    or strpos(public.slugify(coalesce(u.email::text, '')), v_q) > 0
  order by pr.updated_at desc, pr.user_id, pr.story_id;
end;
$$;

-- ── 2. Xóa một điểm chấm ────────────────────────────────────────────────
-- Trigger ratings_count tự trừ rating_counts của truyện.
create function private.admin_delete_rating(p_user_id uuid, p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  delete from public.ratings r where r.user_id = p_user_id and r.story_id = p_story_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ── 3. Lớp vỏ public ────────────────────────────────────────────────────

create function public.admin_ratings(p_query text default null)
returns table (
  user_id uuid,
  user_name text,
  user_email text,
  story_id uuid,
  story_slug text,
  story_title text,
  score integer,
  created_at timestamptz,
  user_rating_count integer,
  user_rating_avg numeric
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_ratings(p_query)
$$;

create function public.admin_delete_rating(p_user_id uuid, p_story_id uuid)
returns void
language sql
set search_path = ''
as $$
  select private.admin_delete_rating(p_user_id, p_story_id)
$$;

-- ── 4. Quyền ────────────────────────────────────────────────────────────

revoke execute on function
  private.admin_ratings(text),
  private.admin_delete_rating(uuid, uuid),
  public.admin_ratings(text),
  public.admin_delete_rating(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  private.admin_ratings(text),
  private.admin_delete_rating(uuid, uuid),
  public.admin_ratings(text),
  public.admin_delete_rating(uuid, uuid)
to authenticated;
