-- Giọng AI cho nghe truyện (plan: documents/plan-giong-ai.md): sổ các đoạn âm thanh đã tạo (file
-- nằm trên Cloudflare R2, khóa theo giọng + hash nội dung), hạn mức ký tự mỗi tháng của cả hệ thống
-- và mỗi ngày của từng người. Chỉ hàm Vercel api/tts (service_role) đọc ghi; quản trị viên xem số
-- liệu qua admin_tts_usage. Ngày và tháng tính theo giờ Việt Nam.

-- ── 1. Bảng ──────────────────────────────────────────────────────────────
-- Mỗi dòng là một file MP3 đã có trên R2: tts/v1/{voice}/{text_hash}.mp3
create table private.tts_clips (
  voice text not null check (char_length(voice) between 1 and 40),
  text_hash text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  chars integer not null check (chars > 0),
  bytes integer not null check (bytes > 0),
  -- Người nghe đầu tiên (người làm tốn hạn mức); xóa tài khoản thì giữ file
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (voice, text_hash)
);
create index tts_clips_created_by_idx on private.tts_clips (created_by);
create index tts_clips_created_at_idx on private.tts_clips (created_at);

-- Số ký tự đã gửi cho Google trong tháng (month = ngày 1); cap là mức chặn api dùng lần gần nhất
create table private.tts_usage_month (
  month date primary key check (extract(day from month) = 1),
  chars bigint not null default 0 check (chars >= 0),
  cap bigint not null check (cap >= 0)
);

-- Số ký tự mỗi người làm tốn trong ngày (nghe lại đoạn đã có không tính)
create table private.tts_usage_day (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  chars integer not null default 0 check (chars >= 0),
  primary key (user_id, day)
);
create index tts_usage_day_day_idx on private.tts_usage_day (day);

alter table private.tts_clips enable row level security;
alter table private.tts_usage_month enable row level security;
alter table private.tts_usage_day enable row level security;
revoke all on private.tts_clips, private.tts_usage_month, private.tts_usage_day
  from public, anon, authenticated;

-- ── 2. Hàm cho api/tts (service_role) ─────────────────────────────────────
-- Các hash (trong danh sách) đã có file của giọng p_voice
create function private.tts_lookup(p_voice text, p_hashes text[])
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select c.text_hash from private.tts_clips c
  where c.voice = p_voice and c.text_hash = any (p_hashes)
$$;

-- Giữ trước p_chars ký tự cho người p_user trước khi gọi Google. Vượt mức tháng / ngày thì ném
-- tts_month_quota / tts_daily_quota và không trừ gì (lỗi hủy cả hàm)
create function private.tts_reserve(
  p_user uuid, p_chars integer, p_month_cap bigint, p_day_cap integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_month date := date_trunc('month', v_today)::date;
  v_month_chars bigint;
  v_day_chars integer;
begin
  if p_user is null or p_chars is null or p_chars <= 0 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  if p_chars > p_month_cap then
    raise exception 'tts_month_quota' using errcode = 'P0001';
  end if;
  insert into private.tts_usage_month as m (month, chars, cap)
  values (v_month, p_chars, p_month_cap)
  on conflict (month) do update set chars = m.chars + excluded.chars, cap = excluded.cap
    where m.chars + excluded.chars <= excluded.cap
  returning m.chars into v_month_chars;
  if v_month_chars is null then
    raise exception 'tts_month_quota' using errcode = 'P0001';
  end if;

  if p_chars > p_day_cap then
    raise exception 'tts_daily_quota' using errcode = 'P0001';
  end if;
  insert into private.tts_usage_day as d (user_id, day, chars)
  values (p_user, v_today, p_chars)
  on conflict (user_id, day) do update set chars = d.chars + excluded.chars
    where d.chars + excluded.chars <= p_day_cap
  returning d.chars into v_day_chars;
  if v_day_chars is null then
    raise exception 'tts_daily_quota' using errcode = 'P0001';
  end if;

  return jsonb_build_object('month', v_month_chars, 'day', v_day_chars);
end;
$$;

-- Ghi các file vừa tải lên R2 (p_clips: [{hash, chars, bytes}], trùng thì bỏ qua) và hoàn lại số
-- ký tự đã giữ mà không tạo được (Google hoặc R2 lỗi)
create function private.tts_commit(p_user uuid, p_voice text, p_clips jsonb, p_refund integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_month date := date_trunc('month', v_today)::date;
begin
  insert into private.tts_clips (voice, text_hash, chars, bytes, created_by)
  select p_voice, c.hash, c.chars, c.bytes, p_user
  from jsonb_to_recordset(coalesce(p_clips, '[]'::jsonb)) as c (hash text, chars integer, bytes integer)
  on conflict (voice, text_hash) do nothing;

  if coalesce(p_refund, 0) > 0 then
    update private.tts_usage_day set chars = greatest(0, chars - p_refund)
    where user_id = p_user and day = v_today;
    update private.tts_usage_month set chars = greatest(0, chars - p_refund)
    where month = v_month;
  end if;
end;
$$;

create function public.tts_lookup(p_voice text, p_hashes text[])
returns setof text
language sql
stable
set search_path = ''
as $$
  select private.tts_lookup(p_voice, p_hashes)
$$;

create function public.tts_reserve(
  p_user uuid, p_chars integer, p_month_cap bigint, p_day_cap integer
)
returns jsonb
language sql
set search_path = ''
as $$
  select private.tts_reserve(p_user, p_chars, p_month_cap, p_day_cap)
$$;

create function public.tts_commit(p_user uuid, p_voice text, p_clips jsonb, p_refund integer)
returns void
language sql
set search_path = ''
as $$
  select private.tts_commit(p_user, p_voice, p_clips, p_refund)
$$;

-- ── 3. Số liệu cho quản trị viên ──────────────────────────────────────────
-- Tháng này: số ký tự đã dùng, mức chặn, số người đã tạo, ký tự theo ngày; tổng số file đã lưu
create function private.admin_tts_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_month date := date_trunc('month', v_today)::date;
  v_month_start timestamptz := v_month::timestamp at time zone 'Asia/Ho_Chi_Minh';
begin
  perform private.require_admin();

  return jsonb_build_object(
    'month', v_month,
    'chars', coalesce((select m.chars from private.tts_usage_month m where m.month = v_month), 0),
    'cap', (select m.cap from private.tts_usage_month m where m.month = v_month),
    'users', (select count(distinct d.user_id) from private.tts_usage_day d where d.day >= v_month),
    'clips', (select count(*) from private.tts_clips),
    'clipsThisMonth',
      (select count(*) from private.tts_clips c where c.created_at >= v_month_start),
    'bytes', (select coalesce(sum(c.bytes), 0) from private.tts_clips c),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'chars', coalesce(u.chars, 0))
        order by g.day), '[]'::jsonb)
      from (select v_month + i as day from generate_series(0, v_today - v_month) as i) g
      left join (
        select d.day, sum(d.chars) as chars from private.tts_usage_day d
        where d.day >= v_month group by d.day
      ) u on u.day = g.day
    )
  );
end;
$$;

create function public.admin_tts_usage()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.admin_tts_usage()
$$;

-- ── 4. Quyền ─────────────────────────────────────────────────────────────
grant usage on schema private to service_role;

revoke execute on function
  private.tts_lookup(text, text[]),
  private.tts_reserve(uuid, integer, bigint, integer),
  private.tts_commit(uuid, text, jsonb, integer),
  private.admin_tts_usage(),
  public.tts_lookup(text, text[]),
  public.tts_reserve(uuid, integer, bigint, integer),
  public.tts_commit(uuid, text, jsonb, integer),
  public.admin_tts_usage()
from public, anon, authenticated;

grant execute on function
  private.tts_lookup(text, text[]),
  private.tts_reserve(uuid, integer, bigint, integer),
  private.tts_commit(uuid, text, jsonb, integer),
  public.tts_lookup(text, text[]),
  public.tts_reserve(uuid, integer, bigint, integer),
  public.tts_commit(uuid, text, jsonb, integer)
to service_role;

grant execute on function private.admin_tts_usage(), public.admin_tts_usage() to authenticated;
