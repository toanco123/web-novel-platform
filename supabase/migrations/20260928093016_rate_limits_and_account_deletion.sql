-- Chống spam (giới hạn tần suất) và tự xóa tài khoản.
-- Vượt giới hạn thì ném 'rate_limited' (bình luận trùng: 'duplicate_comment'); client map sang
-- AuthError('rate_limited') để form hiện lời báo. Mức giới hạn: mục 4 documents/thiet-ke-database.md.

-- ── Bí mật dùng để băm địa chỉ IP ───────────────────────────────────────
-- Chỉ lưu hash của IP (kèm bí mật ngẫu nhiên), không lưu IP gốc.

create table private.secrets (
  name text primary key,
  value text not null
);
alter table private.secrets enable row level security;
revoke all on private.secrets from public, anon, authenticated;

insert into private.secrets (name, value)
values ('ip_hash_salt', encode(extensions.gen_random_bytes(32), 'hex'));

-- Hash IP của request hiện tại (PostgREST đưa header vào request.headers); null khi không có
create function private.request_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_ip text;
begin
  v_ip := coalesce(
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
    nullif(v_headers ->> 'x-real-ip', '')
  );
  if v_ip is null then
    return null;
  end if;
  return encode(extensions.digest(
    v_ip || (select s.value from private.secrets s where s.name = 'ip_hash_salt'),
    'sha256'
  ), 'hex');
end;
$$;

-- ── Lượt đọc: mỗi người (hoặc mỗi IP với khách) chỉ tính 1 lượt / chương / ngày ─────────────

create table private.chapter_view_log (
  -- 'u:<user id>' khi đã đăng nhập, 'ip:<hash>' với khách, 'unknown' khi không có IP
  viewer text not null,
  story_id uuid not null,
  chapter_number integer not null,
  day date not null,
  primary key (viewer, story_id, chapter_number, day)
);
create index chapter_view_log_day_idx on private.chapter_view_log (day);
alter table private.chapter_view_log enable row level security;
revoke all on private.chapter_view_log from public, anon, authenticated;

create or replace function private.record_chapter_view(p_slug text, p_number integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_viewer text;
  v_inserted integer;
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

  v_viewer := coalesce(
    'u:' || (select auth.uid())::text,
    'ip:' || private.request_ip_hash(),
    'unknown'
  );
  insert into private.chapter_view_log (viewer, story_id, chapter_number, day)
  values (v_viewer, v_story_id, p_number, v_day)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  -- Đã tính lượt của người này cho chương này hôm nay (tải lại trang, bấm qua lại...)
  if v_inserted = 0 then
    return;
  end if;

  insert into public.chapter_views as cv (story_id, chapter_number, day, views)
  values (v_story_id, p_number, v_day, 1)
  on conflict (story_id, chapter_number, day) do update set views = cv.views + 1;

  update public.story_stats set view_count = view_count + 1 where story_id = v_story_id;

  -- Thỉnh thoảng dọn nhật ký cũ (chỉ cần hôm nay và hôm qua)
  if random() < 0.02 then
    delete from private.chapter_view_log l where l.day < v_day - 1;
  end if;
end;
$$;

-- ── Bình luận: tối đa 3 / phút, 30 / giờ; không gửi lại nội dung vừa gửi ─────────────────────

create index comments_user_id_created_at_idx on public.comments (user_id, created_at desc);
drop index public.comments_user_id_idx;

-- DEFINER để đếm cả bình luận ở truyện mà RLS không cho người gửi thấy nữa
create function private.comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.comments c
    where c.user_id = new.user_id
      and c.story_id = new.story_id
      and c.chapter_number is not distinct from new.chapter_number
      and c.content = new.content
      and c.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate_comment' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.comments c
    where c.user_id = new.user_id and c.created_at > now() - interval '1 minute'
  ) >= 3
  or (
    select count(*) from public.comments c
    where c.user_id = new.user_id and c.created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function private.comments_rate_limit();

-- ── Tin nhắn liên hệ: tối đa 3 / giờ cho mỗi email, 5 / giờ cho mỗi IP ─────────────────────

alter table public.contact_messages add column ip_hash text;
create index contact_messages_email_created_at_idx
  on public.contact_messages (email, created_at desc);
create index contact_messages_ip_hash_created_at_idx
  on public.contact_messages (ip_hash, created_at desc);

-- DEFINER vì khách không có quyền đọc bảng này
create function private.contact_messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.ip_hash := private.request_ip_hash();
  if (
    select count(*) from public.contact_messages m
    where lower(m.email) = lower(new.email) and m.created_at > now() - interval '1 hour'
  ) >= 3
  or (
    new.ip_hash is not null
    and (
      select count(*) from public.contact_messages m
      where m.ip_hash = new.ip_hash and m.created_at > now() - interval '1 hour'
    ) >= 5
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger contact_messages_rate_limit
  before insert on public.contact_messages
  for each row execute function private.contact_messages_rate_limit();

-- ── Báo lỗi chương: tối đa 10 / giờ cho mỗi người ──────────────────────

create function private.chapter_reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.chapter_reports r
    where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger chapter_reports_rate_limit
  before insert on public.chapter_reports
  for each row execute function private.chapter_reports_rate_limit();

-- ── Tạo thể loại: tối đa 10 / ngày cho mỗi người ──────────────────────

create function private.genres_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and (
    select count(*) from public.genres g
    where g.created_by = new.created_by and g.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger genres_rate_limit
  before insert on public.genres
  for each row execute function private.genres_rate_limit();

-- ── Tự xóa tài khoản ────────────────────────────────────────────────────
-- Xóa auth.users kéo theo hồ sơ, truyện, chương, bình luận, tủ truyện... (khóa ngoại cascade).
-- Ảnh trong Storage không xóa được bằng SQL: client xóa thư mục của mình trước khi gọi hàm này.

create function private.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  delete from auth.users u where u.id = v_uid;
end;
$$;

create function public.delete_account()
returns void
language sql
set search_path = ''
as $$
  select private.delete_account()
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.request_ip_hash(),
  private.comments_rate_limit(),
  private.contact_messages_rate_limit(),
  private.chapter_reports_rate_limit(),
  private.genres_rate_limit(),
  private.delete_account()
from public, anon, authenticated;

grant execute on function private.delete_account() to authenticated;

revoke execute on function public.delete_account() from public, anon, authenticated;
grant execute on function public.delete_account() to authenticated;
