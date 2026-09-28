-- Nền của schema: extension, kiểu enum, schema private, hàm tiện ích và hồ sơ người dùng.
-- Thiết kế tổng thể: documents/thiet-ke-database.md

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Hàm nội bộ (trigger, cập nhật số liệu) để ở schema không lộ ra Data API
create schema if not exists private;
revoke all on schema private from public;

-- ── Kiểu enum (giá trị khớp src/types) ─────────────────────────────────

create type public.story_status as enum ('ongoing', 'completed');
-- Dùng cho cả stories.visibility và chapters.status
create type public.publication_status as enum ('draft', 'published');
create type public.report_reason as enum ('typo', 'missing', 'order', 'violation', 'other');
create type public.report_status as enum ('open', 'resolved');
create type public.contact_topic as enum ('general', 'bug', 'copyright', 'partnership');

-- ── Hàm tiện ích ────────────────────────────────────────────────────────

-- "Ngôn Tình Đô Thị!" → "ngon-tinh-do-thi", cho cùng kết quả với src/lib/slugify.ts.
-- unaccent chỉ là STABLE nên phải chỉ rõ từ điển để khai báo IMMUTABLE (dùng được trong cột generated).
create function public.slugify(value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent(
      'extensions.unaccent'::regdictionary,
      replace(replace(value, 'đ', 'd'), 'Đ', 'D')
    )),
    '[^a-z0-9]+', '-', 'g'
  ))
$$;

revoke execute on function public.slugify(text) from public, anon, authenticated;
grant execute on function public.slugify(text) to anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Hồ sơ người dùng ────────────────────────────────────────────────────
-- Email, provider và mật khẩu nằm ở auth.users; đây chỉ là phần công khai (tên, ảnh).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_url text check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Tạo hồ sơ khi có tài khoản mới. Tên lấy theo thứ tự: display_name (form đăng ký),
-- full_name/name (Google, Facebook), phần trước @ của email.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text;
begin
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
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;

-- Chỉ có tên và ảnh nên ai cũng xem được (hiện ở bình luận, trang truyện)
create policy profiles_select_all on public.profiles
  for select to anon, authenticated
  using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
