-- Điểm danh hằng ngày và phiếu đề cử (giai đoạn 1), plan documents/plan-diem-danh-va-de-cu.md.
-- Mọi lần cộng / trừ phiếu đi qua sổ chung wallet_ledger có cột loại tài sản (currency), để giai
-- đoạn 2 thêm xu ('coin') mà không phải làm lại bảng. Ngày tính theo giờ Việt Nam.

-- ── 1. Kiểu ─────────────────────────────────────────────────────────────

-- Loại tài sản trong ví: phiếu đề cử (giai đoạn 2 thêm 'coin')
create type public.wallet_currency as enum ('ticket');
-- Lý do của một dòng sổ (giai đoạn 2 thêm 'topup', 'unlock_chapter'...)
create type public.ledger_reason as enum ('checkin', 'vote');

-- ── 2. Bảng ─────────────────────────────────────────────────────────────

-- Số dư hiện tại; chỉ private.ledger_post ghi (khóa dòng, không bao giờ âm)
create table public.wallet_balances (
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency public.wallet_currency not null,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, currency)
);

-- Sổ giao dịch: mỗi lần cộng / trừ một dòng, kèm số dư sau giao dịch để đối soát
create table public.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency public.wallet_currency not null,
  amount integer not null check (amount <> 0),
  reason public.ledger_reason not null,
  -- Truyện được đề cử; truyện bị xóa thì dòng sổ vẫn còn
  story_id uuid references public.stories (id) on delete set null,
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);
create index wallet_ledger_user_created_idx on public.wallet_ledger (user_id, created_at desc);
create index wallet_ledger_story_id_idx on public.wallet_ledger (story_id);

-- Mỗi người một dòng mỗi ngày (giờ Việt Nam); streak = số ngày liên tiếp tính tới ngày đó
create table public.daily_checkins (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  streak integer not null check (streak >= 1),
  reward integer not null check (reward > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Lượt đề cử: ai đề cử truyện nào là thông tin riêng (chỉ chủ đọc), số công khai đi qua RPC tổng hợp
create table public.story_votes (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount between 1 and 1000),
  created_at timestamptz not null default now()
);
create index story_votes_story_created_idx on public.story_votes (story_id, created_at);
create index story_votes_created_idx on public.story_votes (created_at);
create index story_votes_user_id_idx on public.story_votes (user_id);

-- Tổng phiếu mọi lúc (bảng xếp hạng "mọi lúc", thống kê của tác giả); chỉ vote_story ghi
alter table public.story_stats add column vote_count bigint not null default 0;

-- ── 3. RLS và quyền: mỗi người chỉ đọc dữ liệu của mình, không ai ghi từ client ──

alter table public.wallet_balances enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.story_votes enable row level security;

revoke all on public.wallet_balances, public.wallet_ledger, public.daily_checkins,
  public.story_votes from anon, authenticated;
grant select on public.wallet_balances, public.wallet_ledger, public.daily_checkins,
  public.story_votes to authenticated;

create policy wallet_balances_select_own on public.wallet_balances
  for select to authenticated using (user_id = (select auth.uid()));
create policy wallet_ledger_select_own on public.wallet_ledger
  for select to authenticated using (user_id = (select auth.uid()));
create policy daily_checkins_select_own on public.daily_checkins
  for select to authenticated using (user_id = (select auth.uid()));
create policy story_votes_select_own on public.story_votes
  for select to authenticated using (user_id = (select auth.uid()));

-- ── 4. Sổ phiếu ─────────────────────────────────────────────────────────

-- Cửa DUY NHẤT đổi số dư: cộng / trừ trong một câu lệnh (khóa dòng số dư nên hai yêu cầu cùng lúc
-- không làm sai số), số dư âm thì báo insufficient_balance, rồi ghi sổ. Trả số dư mới.
-- Không ai gọi được qua API; chỉ các hàm DEFINER bên dưới gọi.
create function private.ledger_post(
  p_user_id uuid,
  p_currency public.wallet_currency,
  p_amount integer,
  p_reason public.ledger_reason,
  p_story_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  begin
    if p_amount > 0 then
      insert into public.wallet_balances as b (user_id, currency, balance)
      values (p_user_id, p_currency, p_amount)
      on conflict (user_id, currency)
        do update set balance = b.balance + excluded.balance, updated_at = now()
      returning b.balance into v_balance;
    else
      -- Trừ: không dùng upsert vì dòng định chèn (số âm) đã vi phạm check trước khi xét trùng khóa
      update public.wallet_balances b
      set balance = b.balance + p_amount, updated_at = now()
      where b.user_id = p_user_id and b.currency = p_currency
      returning b.balance into v_balance;
      if v_balance is null then
        raise exception 'insufficient_balance' using errcode = 'P0001';
      end if;
    end if;
  exception when check_violation then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end;

  insert into public.wallet_ledger (user_id, currency, amount, reason, story_id, balance_after)
  values (p_user_id, p_currency, p_amount, p_reason, p_story_id, v_balance);
  return v_balance;
end;
$$;

-- ── 5. Điểm danh ────────────────────────────────────────────────────────

-- Điểm danh hôm nay: chuỗi = chuỗi của hôm qua + 1 (không thì 1); ngày 7, 14, 21… +3 phiếu, còn lại
-- +1. Lỗi: unauthenticated, already_checked_in. Trả {reward, streak, balance}.
create function private.daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_last public.daily_checkins;
  v_streak integer;
  v_reward integer;
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into v_last
  from public.daily_checkins c
  where c.user_id = v_uid
  order by c.day desc
  limit 1;

  if v_last.day = v_today then
    raise exception 'already_checked_in' using errcode = 'P0001';
  end if;

  v_streak := case when v_last.day = v_today - 1 then v_last.streak + 1 else 1 end;
  v_reward := case when v_streak % 7 = 0 then 3 else 1 end;

  -- Hai yêu cầu cùng lúc: khóa chính (user_id, day) chỉ cho một dòng
  insert into public.daily_checkins (user_id, day, streak, reward)
  values (v_uid, v_today, v_streak, v_reward)
  on conflict do nothing;
  if not found then
    raise exception 'already_checked_in' using errcode = 'P0001';
  end if;

  v_balance := private.ledger_post(v_uid, 'ticket', v_reward, 'checkin');
  return jsonb_build_object('reward', v_reward, 'streak', v_streak, 'balance', v_balance);
end;
$$;

create function public.daily_checkin()
returns jsonb
language sql
set search_path = ''
as $$
  select private.daily_checkin()
$$;

-- Trạng thái điểm danh và số phiếu của người gọi (INVOKER: chỉ đọc dữ liệu của mình qua RLS).
-- streak: chuỗi của lần điểm danh gần nhất nếu là hôm nay hoặc hôm qua, không thì 0.
create function public.reward_status()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_last public.daily_checkins;
  v_streak integer := 0;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;

  select * into v_last
  from public.daily_checkins c
  where c.user_id = v_uid
  order by c.day desc
  limit 1;
  if v_last.day >= v_today - 1 then
    v_streak := v_last.streak;
  end if;

  return jsonb_build_object(
    'balance', coalesce((
      select b.balance from public.wallet_balances b
      where b.user_id = v_uid and b.currency = 'ticket'
    ), 0),
    'today', v_today,
    'checkedInToday', v_last.day is not distinct from v_today,
    'streak', v_streak,
    'nextReward', case when (v_streak + 1) % 7 = 0 then 3 else 1 end
  );
end;
$$;

-- ── 6. Đề cử ────────────────────────────────────────────────────────────

-- Tổng phiếu của một truyện (mọi lúc, 7 ngày). DEFINER vì story_votes chỉ cho chủ đọc; chỉ trả số
-- tổng, không lộ ai đề cử.
create function private.story_vote_counts(p_story_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total', coalesce((select st.vote_count from public.story_stats st where st.story_id = p_story_id), 0),
    'week', coalesce((
      select sum(v.amount) from public.story_votes v
      where v.story_id = p_story_id and v.created_at > now() - interval '7 days'
    ), 0)
  )
$$;

-- Đề cử truyện đang công khai, không phải của mình, tài khoản tạo đủ 3 ngày. Lỗi: unauthenticated,
-- invalid_amount, not_found, own_story, account_too_new, insufficient_tickets. Trả {balance, total}.
create function private.vote_story(p_slug text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_story_id uuid;
  v_owner_id uuid;
  v_balance integer;
  v_total bigint;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  select s.id, s.owner_id into v_story_id, v_owner_id
  from public.stories s
  join public.story_stats st on st.story_id = s.id
  where s.slug = p_slug and s.visibility = 'published' and st.chapter_count > 0;
  if v_story_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_owner_id = v_uid then
    raise exception 'own_story' using errcode = 'P0001';
  end if;
  if (select p.created_at from public.profiles p where p.id = v_uid) > now() - interval '3 days' then
    raise exception 'account_too_new' using errcode = 'P0001';
  end if;

  -- Khóa dòng số dư tới hết transaction rồi mới kiểm tra, để hai lần đề cử cùng lúc không vượt số dư
  select b.balance into v_balance
  from public.wallet_balances b
  where b.user_id = v_uid and b.currency = 'ticket'
  for update;
  if coalesce(v_balance, 0) < p_amount then
    raise exception 'insufficient_tickets' using errcode = 'P0001';
  end if;

  v_balance := private.ledger_post(v_uid, 'ticket', -p_amount, 'vote', v_story_id);
  insert into public.story_votes (story_id, user_id, amount) values (v_story_id, v_uid, p_amount);
  update public.story_stats st
  set vote_count = st.vote_count + p_amount
  where st.story_id = v_story_id
  returning st.vote_count into v_total;

  return jsonb_build_object('balance', v_balance, 'total', v_total);
end;
$$;

create function public.vote_story(p_slug text, p_amount integer)
returns jsonb
language sql
set search_path = ''
as $$
  select private.vote_story(p_slug, p_amount)
$$;

-- Tổng đề cử của truyện đang công khai (khách cũng xem được) và phiếu người gọi đã đề cử.
-- INVOKER: truyện không thấy được (RLS) hoặc chưa công khai thì not_found.
create function public.story_vote_summary(p_slug text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_story_id uuid;
  v_uid uuid := (select auth.uid());
  v_mine bigint := 0;
begin
  select s.id into v_story_id
  from public.stories s
  join public.story_stats st on st.story_id = s.id
  where s.slug = p_slug and s.visibility = 'published' and st.chapter_count > 0;
  if v_story_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- Khách không có quyền đọc story_votes: chỉ đếm phiếu của mình khi đã đăng nhập
  if v_uid is not null then
    select coalesce(sum(v.amount), 0) into v_mine
    from public.story_votes v
    where v.story_id = v_story_id and v.user_id = v_uid;
  end if;

  return private.story_vote_counts(v_story_id) || jsonb_build_object('mine', v_mine);
end;
$$;

-- Xếp hạng theo phiếu trong 7 / 30 ngày (DEFINER: cộng phiếu của mọi người, chỉ trả tổng theo truyện)
create function private.vote_ranking(p_days integer, p_limit integer)
returns table (story_id uuid, value numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select v.story_id, sum(v.amount)::numeric
  from public.story_votes v
  join public.stories s on s.id = v.story_id
  join public.story_stats st on st.story_id = s.id
  where v.created_at > now() - make_interval(days => p_days)
    and s.visibility = 'published'
    and st.chapter_count > 0
  group by v.story_id
  order by sum(v.amount) desc
  limit p_limit
$$;

-- ── 7. Bảng xếp hạng và thống kê thêm phiếu đề cử ───────────────────────

/**
 * Bảng xếp hạng truyện công khai.
 * p_by: views | votes | rating | follows; p_period (với views, votes): week (7 ngày) | month (30 ngày)
 * | all. rating xếp theo điểm có trọng số với 50 lượt chấm "ảo" bằng điểm trung bình chung
 * (RATING_PRIOR), còn value trả về là điểm trung bình thật.
 */
create or replace function public.story_ranking(
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

  elsif p_by = 'votes' and p_period = 'all' then
    return query
    select st.story_id, st.vote_count::numeric
    from public.stories s
    join public.story_stats st on st.story_id = s.id
    where s.visibility = 'published' and st.chapter_count > 0 and st.vote_count > 0
    order by st.vote_count desc
    limit v_limit;

  elsif p_by = 'votes' and p_period in ('week', 'month') then
    return query
    select r.story_id, r.value
    from private.vote_ranking(case when p_period = 'week' then 7 else 30 end, v_limit) r;

  else
    raise exception 'invalid_ranking' using errcode = 'P0001';
  end if;
end;
$$;

-- Như cũ, thêm votes: {total, week}
create or replace function public.studio_story_stats(p_story_id uuid)
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
    'comments', (select count(*) from public.comments cm where cm.story_id = p_story_id),
    'votes', private.story_vote_counts(p_story_id)
  )
  into v_result
  from public.story_stats st
  where st.story_id = p_story_id;

  return v_result;
end;
$$;

-- ── 8. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function
  private.ledger_post(uuid, public.wallet_currency, integer, public.ledger_reason, uuid),
  private.daily_checkin(),
  public.daily_checkin(),
  public.reward_status(),
  private.story_vote_counts(uuid),
  private.vote_story(text, integer),
  public.vote_story(text, integer),
  public.story_vote_summary(text),
  private.vote_ranking(integer, integer)
from public, anon, authenticated;

grant execute on function
  private.daily_checkin(),
  public.daily_checkin(),
  public.reward_status(),
  private.vote_story(text, integer),
  public.vote_story(text, integer)
to authenticated;

-- Khách cũng xem tổng đề cử và bảng xếp hạng (story_vote_summary, story_ranking gọi sang private)
grant execute on function
  private.story_vote_counts(uuid),
  public.story_vote_summary(text),
  private.vote_ranking(integer, integer)
to anon, authenticated;
