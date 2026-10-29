-- Quản trị xem phiếu đề cử: theo truyện, theo người dùng và sổ giao dịch của một người
-- (plan documents/plan-admin-phieu-va-danh-gia.md, mục 1). Chỉ đọc; story_votes, wallet_* chỉ cho
-- chủ đọc nên các hàm đều DEFINER và tự kiểm tra quản trị viên.

-- ── 1. Theo truyện ──────────────────────────────────────────────────────
-- is_concentrated: truyện có từ 10 phiếu và một người chiếm từ 50% (dấu hiệu dồn phiếu).
-- Hàm giữ ngưỡng cùng hằng VOTE_CONCENTRATED_* ở features/admin/shared.ts.
create function private.admin_vote_stories(p_query text)
returns table (
  id uuid,
  slug text,
  title text,
  owner_name text,
  total_votes bigint,
  week_votes bigint,
  voter_count integer,
  top_voter_id uuid,
  top_voter_name text,
  top_share numeric,
  is_concentrated boolean
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
  with per_user as (
    select v.story_id, v.user_id, sum(v.amount)::bigint as amount
    from public.story_votes v
    group by v.story_id, v.user_id
  ),
  agg as (
    select
      pu.story_id,
      sum(pu.amount)::bigint as total,
      count(*)::integer as voters,
      (array_agg(pu.user_id order by pu.amount desc, pu.user_id))[1] as top_user,
      max(pu.amount) as top_amount
    from per_user pu
    group by pu.story_id
  ),
  recent as (
    select v.story_id, sum(v.amount)::bigint as amount
    from public.story_votes v
    where v.created_at > now() - interval '7 days'
    group by v.story_id
  )
  select
    s.id,
    s.slug,
    s.title,
    coalesce(s.author_name, op.display_name, ''),
    a.total,
    coalesce(r.amount, 0)::bigint,
    a.voters,
    a.top_user,
    tp.display_name,
    round(a.top_amount::numeric / a.total, 4),
    a.total >= 10 and a.top_amount::numeric / a.total >= 0.5
  from agg a
  join public.stories s on s.id = a.story_id
  left join public.profiles op on op.id = s.owner_id
  left join public.profiles tp on tp.id = a.top_user
  left join recent r on r.story_id = a.story_id
  where v_q = ''
    or strpos(public.slugify(s.title), v_q) > 0
    or strpos(public.slugify(coalesce(s.author_name, op.display_name, '')), v_q) > 0
  order by a.total desc, s.id;
end;
$$;

-- ── 2. Theo người dùng ──────────────────────────────────────────────────
-- Chỉ người có hoạt động phiếu (đã điểm danh, đã đề cử hoặc đang có phiếu).
-- last_streak: chuỗi ở lần điểm danh gần nhất (không xét có còn liên tiếp tới hôm nay).
create function private.admin_vote_users(p_query text)
returns table (
  id uuid,
  email text,
  display_name text,
  balance integer,
  voted bigint,
  checkin_count integer,
  last_streak integer,
  created_at timestamptz
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
  select t.id, t.email, t.display_name, t.balance, t.voted, t.checkin_count, t.last_streak, t.created_at
  from (
    select
      u.id,
      u.email::text as email,
      coalesce(p.display_name, '') as display_name,
      coalesce(b.balance, 0) as balance,
      coalesce((select sum(v.amount) from public.story_votes v where v.user_id = u.id), 0)::bigint as voted,
      (select count(*)::integer from public.daily_checkins c where c.user_id = u.id) as checkin_count,
      coalesce((
        select c.streak from public.daily_checkins c
        where c.user_id = u.id order by c.day desc limit 1
      ), 0) as last_streak,
      u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.wallet_balances b on b.user_id = u.id and b.currency = 'ticket'
  ) t
  where (t.balance > 0 or t.voted > 0 or t.checkin_count > 0)
    and (
      v_q = ''
      or strpos(public.slugify(t.display_name), v_q) > 0
      or strpos(public.slugify(coalesce(t.email, '')), v_q) > 0
    )
  order by t.voted desc, t.created_at desc, t.id;
end;
$$;

-- ── 3. Sổ giao dịch của một người ───────────────────────────────────────
-- 100 dòng mới nhất; truyện đã bị xóa thì story_* là null.
create function private.admin_user_ledger(p_user_id uuid)
returns table (
  id bigint,
  amount integer,
  reason text,
  story_slug text,
  story_title text,
  balance_after integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();

  return query
  select l.id, l.amount, l.reason::text, s.slug, s.title, l.balance_after, l.created_at
  from public.wallet_ledger l
  left join public.stories s on s.id = l.story_id
  where l.user_id = p_user_id and l.currency = 'ticket'
  order by l.created_at desc, l.id desc
  limit 100;
end;
$$;

-- ── 4. Lớp vỏ public ────────────────────────────────────────────────────

create function public.admin_vote_stories(p_query text default null)
returns table (
  id uuid,
  slug text,
  title text,
  owner_name text,
  total_votes bigint,
  week_votes bigint,
  voter_count integer,
  top_voter_id uuid,
  top_voter_name text,
  top_share numeric,
  is_concentrated boolean
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_vote_stories(p_query)
$$;

create function public.admin_vote_users(p_query text default null)
returns table (
  id uuid,
  email text,
  display_name text,
  balance integer,
  voted bigint,
  checkin_count integer,
  last_streak integer,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_vote_users(p_query)
$$;

create function public.admin_user_ledger(p_user_id uuid)
returns table (
  id bigint,
  amount integer,
  reason text,
  story_slug text,
  story_title text,
  balance_after integer,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_user_ledger(p_user_id)
$$;

-- ── 5. Quyền ────────────────────────────────────────────────────────────

revoke execute on function
  private.admin_vote_stories(text),
  private.admin_vote_users(text),
  private.admin_user_ledger(uuid),
  public.admin_vote_stories(text),
  public.admin_vote_users(text),
  public.admin_user_ledger(uuid)
from public, anon, authenticated;

grant execute on function
  private.admin_vote_stories(text),
  private.admin_vote_users(text),
  private.admin_user_ledger(uuid),
  public.admin_vote_stories(text),
  public.admin_vote_users(text),
  public.admin_user_ledger(uuid)
to authenticated;
