-- Danh mục: thể loại, truyện, chương và số liệu của truyện.
-- Luật của khu Sáng tác (features/studio/api.ts) được giữ ở đây bằng trigger; lỗi nghiệp vụ ném
-- bằng mã trong message (no_published_chapters, last_published_chapter, chapter_number_locked,
-- too_many_genres) để api map sang StudioError.

-- ── Thể loại ────────────────────────────────────────────────────────────

create table public.genres (
  -- Luôn = slugify(name) (trigger đặt), nên "Ngôn Tình" và "ngon tinh" là một
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 30),
  description text check (char_length(description) <= 200),
  -- null: thể loại do quản trị thêm
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index genres_created_by_idx on public.genres (created_by);

create function private.genres_set_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.slug := public.slugify(new.name);
  return new;
end;
$$;

create trigger genres_set_slug
  before insert on public.genres
  for each row execute function private.genres_set_slug();

-- ── Truyện ──────────────────────────────────────────────────────────────

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Không đổi sau khi tạo để link đã chia sẻ vẫn dùng được khi đổi tên truyện
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  status public.story_status not null default 'ongoing',
  visibility public.publication_status not null default 'draft',
  -- Đường dẫn trong bucket covers ({owner_id}/{uuid}.webp)
  cover_path text check (char_length(cover_path) <= 300),
  search_title text generated always as (public.slugify(title)) stored,
  created_at timestamptz not null default now(),
  -- Lần sửa gần nhất của tác giả (sắp xếp danh sách Sáng tác), kể cả khi sửa chương
  updated_at timestamptz not null default now(),
  -- Lần đầu công khai (mục "Truyện mới ra")
  published_at timestamptz
);

create index stories_owner_id_updated_at_idx on public.stories (owner_id, updated_at desc);
create index stories_search_title_trgm_idx
  on public.stories using gin (search_title extensions.gin_trgm_ops);

create table public.story_genres (
  story_id uuid not null references public.stories (id) on delete cascade,
  genre_slug text not null references public.genres (slug) on delete cascade on update cascade,
  -- Thứ tự tác giả chọn
  position smallint not null default 0,
  primary key (story_id, genre_slug)
);

create index story_genres_genre_slug_idx on public.story_genres (genre_slug);

create function private.limit_story_genres()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.story_genres sg where sg.story_id = new.story_id) >= 5 then
    raise exception 'too_many_genres' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger story_genres_limit
  before insert on public.story_genres
  for each row execute function private.limit_story_genres();

-- ── Chương ──────────────────────────────────────────────────────────────

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  -- Tác giả tự chọn, được bỏ trống số ở giữa; chương đã từng xuất bản thì giữ nguyên số
  number integer not null check (number between 1 and 99999),
  title text not null default '' check (char_length(title) <= 120),
  -- Văn bản thuần, các đoạn cách nhau bằng dòng trống
  content text not null check (char_length(content) between 1 and 100000),
  status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lần đầu xuất bản; ẩn rồi xuất bản lại vẫn giữ mốc cũ
  published_at timestamptz,
  unique (story_id, number)
);

-- ── Số liệu của truyện (hệ thống tự ghi, client chỉ đọc) ────────────────

create table public.story_stats (
  story_id uuid primary key references public.stories (id) on delete cascade,
  -- Các cột về chương chỉ tính chương đã xuất bản
  chapter_count integer not null default 0,
  first_chapter_number integer,
  latest_chapter_number integer,
  latest_chapter_title text,
  last_chapter_at timestamptz,
  view_count bigint not null default 0,
  follower_count integer not null default 0,
  -- Số lượt chấm 1..5 sao
  rating_counts integer[] not null default '{0,0,0,0,0}' check (cardinality(rating_counts) = 5),
  rating_count integer generated always as (
    rating_counts[1] + rating_counts[2] + rating_counts[3] + rating_counts[4] + rating_counts[5]
  ) stored,
  rating_sum integer generated always as (
    rating_counts[1] + 2 * rating_counts[2] + 3 * rating_counts[3]
    + 4 * rating_counts[4] + 5 * rating_counts[5]
  ) stored,
  -- 0 khi chưa có lượt chấm nào (giống ratingAvg của mock)
  rating_avg numeric(3, 2) generated always as (
    case
      when rating_counts[1] + rating_counts[2] + rating_counts[3] + rating_counts[4]
        + rating_counts[5] = 0 then 0
      else round(
        (rating_counts[1] + 2 * rating_counts[2] + 3 * rating_counts[3]
          + 4 * rating_counts[4] + 5 * rating_counts[5])::numeric
        / (rating_counts[1] + rating_counts[2] + rating_counts[3] + rating_counts[4]
          + rating_counts[5]),
        2
      )
    end
  ) stored
);

create index story_stats_last_chapter_at_idx on public.story_stats (last_chapter_at desc);
create index story_stats_view_count_idx on public.story_stats (view_count desc);

-- ── Trigger của truyện ──────────────────────────────────────────────────

create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function private.set_updated_at();

create function private.stories_create_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.story_stats (story_id) values (new.id);
  return null;
end;
$$;

create trigger stories_create_stats
  after insert on public.stories
  for each row execute function private.stories_create_stats();

-- Truyện chỉ công khai khi có ít nhất 1 chương đã xuất bản
create function private.stories_check_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'published'
    and (tg_op = 'INSERT' or old.visibility is distinct from 'published') then
    if not exists (
      select 1 from public.chapters c where c.story_id = new.id and c.status = 'published'
    ) then
      raise exception 'no_published_chapters' using errcode = 'P0001';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger stories_check_publish
  before insert or update of visibility on public.stories
  for each row execute function private.stories_check_publish();

-- ── Trigger của chương ──────────────────────────────────────────────────

create trigger chapters_set_updated_at
  before update on public.chapters
  for each row execute function private.set_updated_at();

create function private.chapters_before_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' and new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  -- Link, lịch sử đọc và bình luận của người đọc đều theo số chương
  if tg_op = 'UPDATE' and new.number <> old.number and old.published_at is not null then
    raise exception 'chapter_number_locked' using errcode = 'P0001';
  end if;

  -- Truyện đang công khai không được mất chương công khai cuối cùng. Khi cả truyện đang bị xóa
  -- (cascade) thì dòng truyện đã mất nên điều kiện đầu sai, không chặn.
  if tg_op <> 'INSERT'
    and old.status = 'published'
    and (tg_op = 'DELETE' or new.status <> 'published')
    and exists (
      select 1 from public.stories s where s.id = old.story_id and s.visibility = 'published'
    )
    and not exists (
      select 1 from public.chapters c
      where c.story_id = old.story_id and c.status = 'published' and c.id <> old.id
    ) then
    raise exception 'last_published_chapter' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger chapters_before_change
  before insert or update or delete on public.chapters
  for each row execute function private.chapters_before_change();

-- Tính lại các cột về chương trong story_stats và đánh dấu truyện vừa được sửa
create function private.chapters_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := coalesce(new.story_id, old.story_id);
begin
  update public.story_stats st
  set
    chapter_count = agg.chapter_count,
    first_chapter_number = agg.first_number,
    latest_chapter_number = agg.latest_number,
    latest_chapter_title = agg.latest_title,
    last_chapter_at = agg.last_at
  from (
    select
      count(*)::integer as chapter_count,
      min(c.number) as first_number,
      max(c.number) as latest_number,
      (array_agg(c.title order by c.number desc))[1] as latest_title,
      max(c.published_at) as last_at
    from public.chapters c
    where c.story_id = sid and c.status = 'published'
  ) agg
  where st.story_id = sid;

  update public.stories set updated_at = now() where id = sid;
  return null;
end;
$$;

create trigger chapters_after_change
  after insert or update or delete on public.chapters
  for each row execute function private.chapters_after_change();

-- ── RLS và quyền ────────────────────────────────────────────────────────

alter table public.genres enable row level security;
alter table public.stories enable row level security;
alter table public.story_genres enable row level security;
alter table public.chapters enable row level security;
alter table public.story_stats enable row level security;

create policy genres_select_all on public.genres
  for select to anon, authenticated
  using (true);

create policy genres_insert_authenticated on public.genres
  for insert to authenticated
  with check (created_by = (select auth.uid()));

-- Truyện công khai, cộng truyện nháp của chính mình (xem trước)
create policy stories_select_visible on public.stories
  for select to anon, authenticated
  using (visibility = 'published' or owner_id = (select auth.uid()));

create policy stories_insert_own on public.stories
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy stories_update_own on public.stories
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy stories_delete_own on public.stories
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Các bảng phụ của truyện: thấy được khi thấy truyện (RLS của stories tự lọc trong exists)
create policy story_genres_select_visible on public.story_genres
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = story_genres.story_id));

create policy story_genres_insert_own on public.story_genres
  for insert to authenticated
  with check (exists (
    select 1 from public.stories s
    where s.id = story_genres.story_id and s.owner_id = (select auth.uid())
  ));

create policy story_genres_delete_own on public.story_genres
  for delete to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = story_genres.story_id and s.owner_id = (select auth.uid())
  ));

create policy story_stats_select_visible on public.story_stats
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = story_stats.story_id));

-- Người đọc: chương đã xuất bản của truyện công khai. Chủ truyện: mọi chương (cả nháp).
create policy chapters_select_published on public.chapters
  for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.stories s
      where s.id = chapters.story_id and s.visibility = 'published'
    )
  );

create policy chapters_select_own on public.chapters
  for select to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id and s.owner_id = (select auth.uid())
  ));

create policy chapters_insert_own on public.chapters
  for insert to authenticated
  with check (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id and s.owner_id = (select auth.uid())
  ));

create policy chapters_update_own on public.chapters
  for update to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id and s.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id and s.owner_id = (select auth.uid())
  ));

create policy chapters_delete_own on public.chapters
  for delete to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id and s.owner_id = (select auth.uid())
  ));

-- Quyền theo cột: tác giả chỉ ghi được cột nội dung (slug, owner_id, các mốc thời gian và
-- story_stats do hệ thống ghi). Phải revoke quyền mức bảng thì grant theo cột mới có tác dụng.
revoke all on public.genres, public.stories, public.story_genres, public.chapters,
  public.story_stats from anon, authenticated;

grant select on public.genres, public.stories, public.story_genres, public.chapters,
  public.story_stats to anon, authenticated;

grant insert (name, description) on public.genres to authenticated;

grant insert (slug, title, description, status, cover_path) on public.stories to authenticated;
grant update (title, description, status, visibility, cover_path) on public.stories to authenticated;
grant delete on public.stories to authenticated;

grant insert, delete on public.story_genres to authenticated;

grant insert (story_id, number, title, content, status) on public.chapters to authenticated;
grant update (number, title, content, status) on public.chapters to authenticated;
grant delete on public.chapters to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
