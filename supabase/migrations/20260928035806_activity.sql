-- Hoạt động của người đọc: theo dõi, lịch sử đọc, chấm điểm, bình luận, báo lỗi chương, lượt đọc;
-- cùng tin nhắn liên hệ và danh sách truyện chọn tay cho trang chủ.
-- Bình luận, báo lỗi và lượt đọc gắn với chương qua khóa ghép (story_id, chapter_number):
-- xóa chương thì các dòng này tự xóa theo (giống deleteChapter của mock).

-- ── Theo dõi ────────────────────────────────────────────────────────────

create table public.follows (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  followed_at timestamptz not null default now(),
  -- Chương mới nhất người dùng đã thấy; số chương mới = chương xuất bản có số lớn hơn mốc này
  seen_chapter integer not null default 0 check (seen_chapter >= 0),
  primary key (user_id, story_id)
);

create index follows_story_id_idx on public.follows (story_id);

-- ── Lịch sử đọc (mỗi truyện một dòng: chỗ đọc dở) ──────────────────────
-- Không có khóa ngoại tới chương để lịch sử vẫn còn khi tác giả ẩn/xóa chương.
-- Lịch sử của khách chưa đăng nhập vẫn ở localStorage, gộp lên bằng merge_guest_history.

create table public.reading_history (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_number integer not null check (chapter_number between 1 and 99999),
  chapter_title text not null default '' check (char_length(chapter_title) <= 120),
  -- Tỉ lệ đã cuộn trong chương
  progress real not null default 0 check (progress between 0 and 1),
  read_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index reading_history_user_id_read_at_idx on public.reading_history (user_id, read_at desc);
create index reading_history_story_id_idx on public.reading_history (story_id);

-- ── Chấm điểm ───────────────────────────────────────────────────────────

create table public.ratings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index ratings_story_id_idx on public.ratings (story_id);

-- ── Bình luận ───────────────────────────────────────────────────────────

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  -- null: bình luận của cả truyện; có số: bình luận của chương đó
  chapter_number integer,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (story_id, chapter_number)
    references public.chapters (story_id, number) on delete cascade on update cascade
);

create index comments_story_chapter_created_idx
  on public.comments (story_id, chapter_number, created_at desc);
create index comments_user_id_idx on public.comments (user_id);

-- ── Báo lỗi chương ──────────────────────────────────────────────────────

create table public.chapter_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null,
  chapter_number integer not null,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  note text not null default '' check (char_length(note) <= 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (story_id, chapter_number)
    references public.chapters (story_id, number) on delete cascade on update cascade,
  check (reason <> 'other' or note <> '')
);

-- Cùng người, cùng chương, cùng lý do mà báo lỗi cũ chưa xử lý thì chỉ cập nhật ghi chú
create unique index chapter_reports_open_unique
  on public.chapter_reports (reporter_id, story_id, chapter_number, reason)
  where status = 'open';
create index chapter_reports_story_status_created_idx
  on public.chapter_reports (story_id, status, created_at desc);
create index chapter_reports_reporter_id_idx on public.chapter_reports (reporter_id);

-- ── Lượt đọc (theo chương, theo ngày giờ Việt Nam) ─────────────────────
-- Chỉ ghi qua RPC record_chapter_view; tổng lượt đọc của truyện nằm ở story_stats.view_count.

create table public.chapter_views (
  story_id uuid not null,
  chapter_number integer not null,
  day date not null,
  views integer not null default 0 check (views >= 0),
  primary key (story_id, chapter_number, day),
  foreign key (story_id, chapter_number)
    references public.chapters (story_id, number) on delete cascade on update cascade
);

create index chapter_views_day_story_idx on public.chapter_views (day, story_id) include (views);

-- ── Tin nhắn liên hệ ────────────────────────────────────────────────────

create table public.contact_messages (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 2 and 60),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic public.contact_topic not null,
  message text not null check (char_length(message) between 10 and 2000),
  created_at timestamptz not null default now()
);

create index contact_messages_user_id_idx on public.contact_messages (user_id);

-- ── Truyện chọn tay cho trang chủ (sửa qua Dashboard) ──────────────────

create table public.curated_stories (
  list text not null check (list in ('featured', 'editor_pick')),
  story_id uuid not null references public.stories (id) on delete cascade,
  position smallint not null default 0,
  primary key (list, story_id)
);

create index curated_stories_story_id_idx on public.curated_stories (story_id);

-- ── Trigger ─────────────────────────────────────────────────────────────

-- Mốc "đã thấy" khi theo dõi: chương mới nhất hiện có, hoặc chương đã đọc tới nếu xa hơn
create function private.follows_set_seen_chapter()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.seen_chapter := greatest(
    new.seen_chapter,
    coalesce((
      select st.latest_chapter_number from public.story_stats st where st.story_id = new.story_id
    ), 0),
    coalesce((
      select h.chapter_number from public.reading_history h
      where h.user_id = new.user_id and h.story_id = new.story_id
    ), 0)
  );
  return new;
end;
$$;

create trigger follows_set_seen_chapter
  before insert on public.follows
  for each row execute function private.follows_set_seen_chapter();

create function private.follows_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.story_stats set follower_count = follower_count + 1
    where story_id = new.story_id;
  else
    update public.story_stats set follower_count = greatest(follower_count - 1, 0)
    where story_id = old.story_id;
  end if;
  return null;
end;
$$;

create trigger follows_count
  after insert or delete on public.follows
  for each row execute function private.follows_count();

-- Đọc tới chương xa hơn mốc "đã thấy" của truyện đang theo dõi thì nâng mốc
create function private.reading_history_bump_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.follows f
  set seen_chapter = new.chapter_number
  where f.user_id = new.user_id
    and f.story_id = new.story_id
    and f.seen_chapter < new.chapter_number;
  return null;
end;
$$;

create trigger reading_history_bump_seen
  after insert or update on public.reading_history
  for each row execute function private.reading_history_bump_seen();

create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function private.set_updated_at();

create function private.ratings_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.story_stats
    set rating_counts[old.score] = greatest(rating_counts[old.score] - 1, 0)
    where story_id = old.story_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.story_stats
    set rating_counts[new.score] = rating_counts[new.score] + 1
    where story_id = new.story_id;
  end if;
  return null;
end;
$$;

create trigger ratings_count
  after insert or update or delete on public.ratings
  for each row execute function private.ratings_count();

create function private.chapter_reports_set_resolved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := now();
  elsif new.status = 'open' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger chapter_reports_set_resolved_at
  before update of status on public.chapter_reports
  for each row execute function private.chapter_reports_set_resolved_at();

-- ── RLS ─────────────────────────────────────────────────────────────────

alter table public.follows enable row level security;
alter table public.reading_history enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;
alter table public.chapter_reports enable row level security;
alter table public.chapter_views enable row level security;
alter table public.contact_messages enable row level security;
alter table public.curated_stories enable row level security;

-- Theo dõi, lịch sử đọc, chấm điểm: chỉ chủ sở hữu thấy và sửa
create policy follows_select_own on public.follows
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy follows_insert_own on public.follows
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.stories s where s.id = follows.story_id)
  );

create policy follows_update_own on public.follows
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy follows_delete_own on public.follows
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy reading_history_select_own on public.reading_history
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy reading_history_insert_own on public.reading_history
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy reading_history_update_own on public.reading_history
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy reading_history_delete_own on public.reading_history
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy ratings_select_own on public.ratings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy ratings_insert_own on public.ratings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = ratings.story_id and s.visibility = 'published'
    )
  );

create policy ratings_update_own on public.ratings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = ratings.story_id and s.visibility = 'published'
    )
  );

create policy ratings_delete_own on public.ratings
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Bình luận: ai thấy truyện thì thấy bình luận; viết vào truyện công khai / chương đã xuất bản
create policy comments_select_visible on public.comments
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = comments.story_id));

create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
      where s.id = comments.story_id and s.visibility = 'published'
    )
    and (
      comments.chapter_number is null
      or exists (
        select 1 from public.chapters c
        where c.story_id = comments.story_id
          and c.number = comments.chapter_number
          and c.status = 'published'
      )
    )
  );

create policy comments_delete_own on public.comments
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Báo lỗi: người gửi và chủ truyện thấy; chủ truyện đổi trạng thái; người gửi sửa ghi chú
-- khi báo lại (report_chapter)
create policy chapter_reports_select_involved on public.chapter_reports
  for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or exists (
      select 1 from public.stories s
      where s.id = chapter_reports.story_id and s.owner_id = (select auth.uid())
    )
  );

create policy chapter_reports_insert_own on public.chapter_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1
      from public.chapters c
      join public.stories s on s.id = c.story_id
      where c.story_id = chapter_reports.story_id
        and c.number = chapter_reports.chapter_number
        and c.status = 'published'
        and s.visibility = 'published'
    )
  );

create policy chapter_reports_update_story_owner on public.chapter_reports
  for update to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = chapter_reports.story_id and s.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.stories s
    where s.id = chapter_reports.story_id and s.owner_id = (select auth.uid())
  ));

create policy chapter_reports_update_reporter on public.chapter_reports
  for update to authenticated
  using (reporter_id = (select auth.uid()) and status = 'open')
  with check (reporter_id = (select auth.uid()) and status = 'open');

create policy chapter_views_select_visible on public.chapter_views
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = chapter_views.story_id));

create policy contact_messages_insert on public.contact_messages
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create policy curated_stories_select_visible on public.curated_stories
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = curated_stories.story_id));

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke all on public.follows, public.reading_history, public.ratings, public.comments,
  public.chapter_reports, public.chapter_views, public.contact_messages,
  public.curated_stories from anon, authenticated;

grant select, delete on public.follows to authenticated;
grant insert (story_id) on public.follows to authenticated;
-- Chỉ để trigger reading_history_bump_seen (chạy bằng quyền người đọc) nâng mốc
grant update (seen_chapter) on public.follows to authenticated;

grant select, delete on public.reading_history to authenticated;
grant insert (story_id, chapter_number, chapter_title, progress, read_at),
  update (chapter_number, chapter_title, progress, read_at)
  on public.reading_history to authenticated;

-- Upsert của PostgREST ghi lại mọi cột trong payload nên cấp quyền update cả bảng
-- (policy vẫn chặn đổi sang người khác)
grant select, insert, update, delete on public.ratings to authenticated;

grant select on public.comments to anon, authenticated;
grant insert (story_id, chapter_number, content) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant select on public.chapter_reports to authenticated;
grant insert (story_id, chapter_number, reason, note) on public.chapter_reports to authenticated;
grant update (note, status, created_at) on public.chapter_reports to authenticated;

grant select on public.chapter_views to anon, authenticated;

-- Không cấp select: gửi xong không đọc lại được (api insert không kèm .select())
grant insert (name, email, topic, message) on public.contact_messages to anon, authenticated;

grant select on public.curated_stories to anon, authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
