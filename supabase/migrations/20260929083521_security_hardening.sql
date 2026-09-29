-- Siết chống lạm dụng sau lượt rà soát bảo mật (gọi thẳng API bằng Postman, bỏ qua giao diện):
-- 1. Hạn mức mỗi ngày của tác giả (truyện mới, chương mới, dung lượng nội dung chương ghi vào) và
--    hạn mức ảnh tải lên Storage: một tài khoản không làm đầy được database / Storage.
-- 2. Người gửi báo lỗi không tự sửa created_at được nữa (trước đây lùi mốc để né giới hạn 10 / giờ).
-- 3. avatar_url chỉ nhận ảnh trong bucket avatars của chính mình; ảnh lúc đăng ký chỉ lấy từ
--    Google/Facebook (trước đây gắn được link ngoài bất kỳ, vd ảnh theo dõi).
-- Mức giới hạn: mục 4 documents/thiet-ke-database.md.

-- ── 1. Hạn mức tác giả ──────────────────────────────────────────────────

-- Cộng dồn theo ngày giờ Việt Nam. Tính cả truyện/chương đã xóa sau đó (tạo rồi xóa liên tục vẫn
-- tốn tài nguyên), và tính cả dung lượng khi sửa nội dung chương (tạo chương ngắn rồi sửa cho dài).
create table private.author_daily_usage (
  user_id uuid not null,
  day date not null,
  stories integer not null default 0,
  chapters integer not null default 0,
  content_bytes bigint not null default 0,
  primary key (user_id, day)
);
alter table private.author_daily_usage enable row level security;
revoke all on private.author_daily_usage from public, anon, authenticated;

-- Ghi thêm vào hạn mức hôm nay của người gọi; vượt thì ném lỗi (cả lệnh ghi bị hủy, không bị tính).
-- Quản trị viên (nhập truyện hàng loạt) và lệnh không có người gọi (SQL editor) không bị giới hạn.
create function private.charge_author(p_stories integer, p_chapters integer, p_bytes bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_usage private.author_daily_usage;
begin
  if v_uid is null or private.is_admin() then
    return;
  end if;

  insert into private.author_daily_usage as u (user_id, day, stories, chapters, content_bytes)
  values (v_uid, v_day, p_stories, p_chapters, p_bytes)
  on conflict (user_id, day) do update set
    stories = u.stories + excluded.stories,
    chapters = u.chapters + excluded.chapters,
    content_bytes = u.content_bytes + excluded.content_bytes
  returning * into v_usage;

  if v_usage.stories > 10 then
    raise exception 'story_limit' using errcode = 'P0001';
  end if;
  if v_usage.chapters > 500 or v_usage.content_bytes > 10000000 then
    raise exception 'chapter_limit' using errcode = 'P0001';
  end if;

  -- Thỉnh thoảng dọn số liệu cũ (chỉ cần hôm nay)
  if random() < 0.02 then
    delete from private.author_daily_usage u where u.day < v_day - 1;
  end if;
end;
$$;

-- DEFINER để gọi được private.charge_author (người gọi không có quyền chạy hàm này)
create function private.stories_charge_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.charge_author(1, 0, 0);
  return new;
end;
$$;

create trigger stories_charge_author
  before insert on public.stories
  for each row execute function private.stories_charge_author();

create function private.chapters_charge_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.charge_author(0, 1, octet_length(new.content));
  elsif new.content is distinct from old.content then
    perform private.charge_author(0, 0, octet_length(new.content));
  end if;
  return new;
end;
$$;

create trigger chapters_charge_author
  before insert or update of content on public.chapters
  for each row execute function private.chapters_charge_author();

-- Ảnh: tối đa 30 ảnh mới / 24 giờ và 300 ảnh đang lưu mỗi người (bìa + ảnh đại diện). Ảnh cũ bị
-- thay thì client xóa đi nên không tính vào tổng. Bị chặn thì Storage trả lỗi RLS (403).
-- Policy không đếm thẳng trên storage.objects được (Postgres báo đệ quy policy) nên đếm trong hàm
-- DEFINER (postgres có BYPASSRLS); policy chạy bằng quyền người gọi nên phải cấp quyền chạy hàm.
create function private.image_upload_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or (
    select count(*) < 300
      and count(*) filter (where o.created_at > now() - interval '1 day') < 30
    from storage.objects o
    where o.bucket_id in ('covers', 'avatars')
      and starts_with(o.name, (select auth.uid())::text || '/')
  )
$$;

drop policy images_insert_own on storage.objects;

create policy images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('covers', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.image_upload_allowed())
  );

-- ── 2. Báo lỗi: created_at do DB đặt ────────────────────────────────────

revoke update (created_at) on public.chapter_reports from authenticated;

-- Báo lại (report_chapter sửa ghi chú) thì báo lỗi lên đầu danh sách như báo mới
create function private.chapter_reports_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

create trigger chapter_reports_touch
  before update of note on public.chapter_reports
  for each row execute function private.chapter_reports_touch();

-- Như bản cũ, bỏ created_at = now() (trigger chapter_reports_touch đặt)
create or replace function public.report_chapter(
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
  do update set note = excluded.note
  returning * into v_row;

  return v_row;
end;
$$;

-- ── 3. Ảnh đại diện ─────────────────────────────────────────────────────

-- Đổi ảnh: chỉ nhận null (bỏ ảnh) hoặc ảnh trong thư mục của chính mình trên bucket avatars của
-- project này (public URL như publicImageUrl ở src/lib/imageUpload.ts). Giữ nguyên ảnh cũ (vd ảnh
-- Google lúc đăng ký) khi chỉ đổi tên thì không kiểm tra.
create function private.profiles_check_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_url is not null
    and new.avatar_url is distinct from old.avatar_url
    and not starts_with(
      new.avatar_url,
      'https://zsbyjxaaxtylgmxybzpf.supabase.co/storage/v1/object/public/avatars/'
        || new.id::text || '/'
    )
  then
    raise exception 'invalid_avatar_url' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_check_avatar
  before update of avatar_url on public.profiles
  for each row execute function private.profiles_check_avatar();

-- Như bản cũ, nhưng ảnh chỉ lấy khi đăng nhập bằng Google/Facebook: đăng ký bằng email thì
-- raw_user_meta_data do người dùng tự gửi lên (options.data), không tin được.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text;
  avatar text;
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') in ('google', 'facebook') then
    avatar := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
    if not (starts_with(avatar, 'https://') and char_length(avatar) <= 2048) then
      avatar := null;
    end if;
  end if;

  name := btrim(left(coalesce(
    nullif(btrim(meta ->> 'display_name'), ''),
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Bạn đọc'
  ), 30));

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(name, ''), 'Bạn đọc'),
    avatar
  );
  return new;
end;
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.charge_author(integer, integer, bigint),
  private.stories_charge_author(),
  private.chapters_charge_author(),
  private.chapter_reports_touch(),
  private.profiles_check_avatar(),
  private.handle_new_user(),
  private.image_upload_allowed()
from public, anon, authenticated;

grant execute on function private.image_upload_allowed() to authenticated;
