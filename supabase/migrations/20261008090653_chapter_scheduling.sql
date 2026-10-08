-- Hẹn giờ đăng chương (plan: documents/plan-hen-gio-dang-chuong.md).
-- Chương nháp có scheduled_at; pg_cron mỗi phút xuất bản chương tới giờ, nên mọi trigger sẵn có
-- (published_at, story_stats, thông báo đẩy) chạy như khi tác giả bấm xuất bản.
-- Tương thích ngược với app di động: chỉ thêm cột, hàm; story_cards giữ các cột cũ.

-- ── 1. Cột giờ hẹn ──────────────────────────────────────────────────────

-- null: không hẹn. Chỉ chương nháp có giờ hẹn (xuất bản thì trigger bỏ giờ hẹn).
alter table public.chapters
  add column scheduled_at timestamptz,
  add constraint chapters_scheduled_draft check (scheduled_at is null or status = 'draft');

-- Cron tìm chương tới giờ; trigger tìm chương sắp ra của truyện
create index chapters_scheduled_at_idx on public.chapters (scheduled_at)
  where scheduled_at is not null;

grant insert (scheduled_at), update (scheduled_at) on public.chapters to authenticated;

-- Như bản của migration story_review, thêm hai luật hẹn giờ:
-- - chương chuyển sang xuất bản thì bỏ giờ hẹn; chương đang xuất bản không có giờ hẹn;
-- - giờ hẹn được đặt hoặc đổi phải sau hiện tại ít nhất 1 phút và trong vòng 365 ngày
--   (chỉ kiểm tra khi đổi, để sửa nội dung chương sát giờ hẹn không lỗi).
create or replace function private.chapters_before_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' and new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if tg_op <> 'DELETE' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
      new.scheduled_at := null;
    end if;
    if new.scheduled_at is not null then
      if new.status <> 'draft' then
        raise exception 'invalid_schedule' using errcode = 'P0001';
      end if;
      if (tg_op = 'INSERT' or new.scheduled_at is distinct from old.scheduled_at)
        and (new.scheduled_at < now() + interval '1 minute'
          or new.scheduled_at > now() + interval '365 days')
      then
        raise exception 'invalid_schedule' using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Link, lịch sử đọc và bình luận của người đọc đều theo số chương
  if tg_op = 'UPDATE' and new.number <> old.number and old.published_at is not null then
    raise exception 'chapter_number_locked' using errcode = 'P0001';
  end if;

  -- Truyện đang công khai hoặc đang chờ duyệt (quản trị viên cần chương để đọc) không được mất
  -- chương công khai cuối cùng. Khi cả truyện đang bị xóa (cascade) thì dòng truyện đã mất nên
  -- điều kiện đầu sai, không chặn.
  if tg_op <> 'INSERT'
    and old.status = 'published'
    and (tg_op = 'DELETE' or new.status <> 'published')
    and exists (
      select 1 from public.stories s
      where s.id = old.story_id and (s.visibility = 'published' or s.review_status = 'pending')
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

-- ── 2. Chương sắp ra (người đọc thấy số chương và giờ ra) ───────────────

alter table public.story_stats
  add column next_chapter_number integer,
  add column next_chapter_at timestamptz;

-- Như bản của migration counters_skip_deleted_story, thêm chương hẹn giờ sớm nhất
create or replace function private.chapters_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := coalesce(new.story_id, old.story_id);
begin
  if not exists (select 1 from public.stories s where s.id = sid) then
    return null;
  end if;

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

  -- Không còn chương hẹn giờ thì hai cột về null
  update public.story_stats st
  set (next_chapter_number, next_chapter_at) = (
    select c.number, c.scheduled_at
    from public.chapters c
    where c.story_id = sid and c.status = 'draft' and c.scheduled_at is not null
    order by c.scheduled_at, c.number
    limit 1
  )
  where st.story_id = sid;

  update public.stories set updated_at = now() where id = sid;
  return null;
end;
$$;

-- Như bản của migration story_author_name, thêm hai cột chương sắp ra ở cuối
create or replace view public.story_cards
with (security_invoker = true)
as
select
  s.id,
  s.slug,
  s.title,
  s.description,
  s.status,
  s.visibility,
  s.owner_id,
  coalesce(s.author_name, p.display_name) as author_name,
  s.cover_path,
  coalesce(g.genres, '[]'::jsonb) as genres,
  coalesce(g.genre_slugs, '{}'::text[]) as genre_slugs,
  st.chapter_count,
  st.first_chapter_number,
  st.latest_chapter_number,
  st.latest_chapter_title,
  st.view_count,
  st.follower_count,
  st.rating_count,
  st.rating_avg,
  st.rating_counts,
  coalesce(s.published_at, s.created_at) as created_at,
  greatest(st.last_chapter_at, s.published_at, s.created_at) as updated_at,
  -- Truyện cùng chủ và cùng bút danh là "cùng tác giả" (null: không đặt bút danh)
  public.slugify(s.author_name) as author_key,
  st.next_chapter_number,
  st.next_chapter_at
from public.stories s
join public.profiles p on p.id = s.owner_id
join public.story_stats st on st.story_id = s.id
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object('slug', gg.slug, 'name', gg.name, 'description', gg.description)
      order by sg.position, gg.name
    ) as genres,
    array_agg(gg.slug order by sg.position, gg.name) as genre_slugs
  from public.story_genres sg
  join public.genres gg on gg.slug = sg.genre_slug
  where sg.story_id = s.id
) g on true;

-- ── 3. Xếp lịch nhiều chương một lần ────────────────────────────────────

-- p_items: [{"number": int, "at": timestamptz}]. INVOKER: RLS của chapters áp dụng. Truyện không
-- phải của mình hoặc chương không có thì not_found; chương không phải nháp hay giờ sai thì
-- invalid_schedule. Lỗi ở một chương thì cả lịch không lưu (một transaction).
create function public.schedule_chapters(p_story_id uuid, p_items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_item record;
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.stories s
    where s.id = p_story_id and s.owner_id = (select auth.uid())
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_items) as i (number integer, at timestamptz)
  loop
    update public.chapters c
    set scheduled_at = v_item.at
    where c.story_id = p_story_id and c.number = v_item.number and c.status = 'draft';
    if not found then
      if exists (
        select 1 from public.chapters c
        where c.story_id = p_story_id and c.number = v_item.number
      ) then
        raise exception 'invalid_schedule' using errcode = 'P0001';
      end if;
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ── 4. Tự xuất bản chương tới giờ ───────────────────────────────────────

-- Mỗi chương một khối riêng: một chương lỗi (trigger chặn) thì bỏ giờ hẹn, giữ nháp, các chương
-- khác vẫn ra. Trả số chương đã xuất bản. p_now: mốc "tới giờ" (cron dùng mặc định; ca kiểm tra SQL
-- truyền mốc tương lai để giả lập tới giờ, vì now() không đổi trong transaction).
create function private.publish_due_chapters(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapter record;
  v_count integer := 0;
begin
  for v_chapter in
    select c.id
    from public.chapters c
    where c.status = 'draft' and c.scheduled_at <= p_now
    order by c.scheduled_at, c.number
    for update skip locked
  loop
    begin
      update public.chapters c set status = 'published' where c.id = v_chapter.id;
      v_count := v_count + 1;
    exception when others then
      update public.chapters c set scheduled_at = null where c.id = v_chapter.id;
      raise warning 'publish_due_chapters: chương % không xuất bản được: %', v_chapter.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;

-- Chạy mỗi phút (đặt lại cùng tên thì cron cập nhật job cũ)
select cron.schedule(
  'publish-scheduled-chapters',
  '* * * * *',
  $$select private.publish_due_chapters()$$
);

-- ── 5. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function
  private.publish_due_chapters(timestamptz),
  public.schedule_chapters(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.schedule_chapters(uuid, jsonb) to authenticated;
