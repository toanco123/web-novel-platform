-- Hộp thông báo trong ứng dụng (plan documents/plan-thong-bao.md, mục 1): chương mới của truyện đang
-- theo dõi, trả lời bình luận, bình luận vào truyện của mình, kết quả duyệt / gỡ truyện. Chỉ
-- private.notify (DEFINER) ghi được; chủ chỉ đọc, đánh dấu đã đọc và xóa dòng của mình.

-- ── 1. Bảng notifications ───────────────────────────────────────────────

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'chapter.new', 'comment.reply', 'comment.story',
    'story.approved', 'story.rejected', 'story.takedown', 'story.restored',
    'announcement'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 300),
  -- Đường dẫn trong web; null: không bấm được
  link text check (link is null or (link like '/%' and char_length(link) <= 300)),
  -- Truyện liên quan, để gộp thông báo chương mới; mất truyện thì mất thông báo
  story_id uuid references public.stories (id) on delete cascade,
  -- Số chương đã gộp vào một thông báo chapter.new chưa đọc
  chapter_count integer not null default 1,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_story_id_idx on public.notifications (story_id);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
-- Chủ chỉ đánh dấu đã đọc
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── 2. Ghi thông báo ────────────────────────────────────────────────────

/** Thêm một thông báo; dọn luôn thông báo quá 90 ngày của người nhận */
create function private.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_story_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.user_id = p_user_id and n.created_at < now() - interval '90 days';
  insert into public.notifications (user_id, type, title, body, link, story_id)
  values (p_user_id, p_type, left(p_title, 120), left(coalesce(p_body, ''), 300), p_link, p_story_id);
end;
$$;

/** `a` đã chặn `b` (hoặc ngược lại) thì không gửi thông báo bình luận cho nhau */
create function private.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks k
    where (k.blocker_id = a and k.blocked_id = b) or (k.blocker_id = b and k.blocked_id = a)
  )
$$;

-- ── 3. Chương mới ───────────────────────────────────────────────────────

-- `chapters`: mảng {story_id, number, title} như send_chapter_push. Mỗi người theo dõi (trừ tác giả)
-- nhận một thông báo cho mỗi truyện; còn thông báo chapter.new chưa đọc của truyện đó thì gộp vào
-- (cộng số chương, đưa lên đầu) thay vì thêm dòng.
create function private.notify_new_chapters(chapters jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  f record;
  v_count integer;
  v_body text;
begin
  for item in
    select
      s.id as story_id,
      s.slug,
      s.title as story_title,
      s.owner_id,
      count(*)::integer as new_count,
      (array_agg(c.number order by c.number desc))[1] as number,
      (array_agg(c.title order by c.number desc))[1] as title
    from jsonb_to_recordset(chapters) as c (story_id uuid, number integer, title text)
    join public.stories s on s.id = c.story_id
    where s.visibility = 'published'
    group by s.id, s.slug, s.title, s.owner_id
  loop
    for f in
      select fo.user_id from public.follows fo
      where fo.story_id = item.story_id and fo.user_id is distinct from item.owner_id
    loop
      update public.notifications n
      set chapter_count = n.chapter_count + item.new_count,
        body = case
          when n.chapter_count + item.new_count > 1 then
            (n.chapter_count + item.new_count) || ' chương mới, mới nhất chương ' || item.number
          when item.title <> '' then 'Chương ' || item.number || ': ' || item.title
          else 'Chương ' || item.number
        end,
        link = '/story/' || item.slug || '/chapter-' || item.number,
        created_at = now()
      where n.user_id = f.user_id and n.type = 'chapter.new'
        and n.story_id = item.story_id and n.read_at is null;
      if found then
        continue;
      end if;

      v_count := item.new_count;
      v_body := case
        when v_count > 1 then v_count || ' chương mới, mới nhất chương ' || item.number
        when item.title <> '' then 'Chương ' || item.number || ': ' || item.title
        else 'Chương ' || item.number
      end;
      perform private.notify(
        f.user_id, 'chapter.new', item.story_title, v_body,
        '/story/' || item.slug || '/chapter-' || item.number, item.story_id);
      update public.notifications n
      set chapter_count = v_count
      where n.id = (
        select max(x.id) from public.notifications x
        where x.user_id = f.user_id and x.type = 'chapter.new' and x.story_id = item.story_id
      );
    end loop;
  end loop;
end;
$$;

-- Hai trigger gửi push chương mới: gọi thêm notify_new_chapters với cùng danh sách chương
create or replace function private.chapters_push_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapters jsonb;
begin
  select jsonb_agg(jsonb_build_object('story_id', n.story_id, 'number', n.number, 'title', n.title))
  into v_chapters
  from new_rows n where n.status = 'published';
  perform private.notify_new_chapters(v_chapters);
  perform private.send_chapter_push(v_chapters);
  return null;
end;
$$;

create or replace function private.chapters_push_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapters jsonb;
begin
  select jsonb_agg(jsonb_build_object('story_id', n.story_id, 'number', n.number, 'title', n.title))
  into v_chapters
  from new_rows n
  join old_rows o on o.id = n.id
  where n.status = 'published' and o.published_at is null;
  perform private.notify_new_chapters(v_chapters);
  perform private.send_chapter_push(v_chapters);
  return null;
end;
$$;

-- ── 4. Bình luận ────────────────────────────────────────────────────────

create function private.comments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story record;
  v_name text;
  v_parent_user uuid;
  v_link text;
begin
  select s.slug, s.title, s.owner_id into v_story from public.stories s where s.id = new.story_id;
  if not found then
    return null;
  end if;
  select coalesce(nullif(p.display_name, ''), 'Một người đọc') into v_name
  from public.profiles p where p.id = new.user_id;
  v_link := case
    when new.chapter_number is null then '/story/' || v_story.slug
    else '/story/' || v_story.slug || '/chapter-' || new.chapter_number
  end;

  if new.parent_id is not null then
    select c.user_id into v_parent_user from public.comments c where c.id = new.parent_id;
    if v_parent_user is not null and v_parent_user <> new.user_id
       and not private.blocked_between(v_parent_user, new.user_id) then
      perform private.notify(
        v_parent_user, 'comment.reply',
        coalesce(v_name, 'Một người đọc') || ' đã trả lời bình luận của bạn',
        new.content, v_link, new.story_id);
    end if;
  elsif v_story.owner_id is not null and v_story.owner_id <> new.user_id
        and not private.blocked_between(v_story.owner_id, new.user_id) then
    perform private.notify(
      v_story.owner_id, 'comment.story',
      coalesce(v_name, 'Một người đọc') || ' bình luận trong "' || v_story.title || '"',
      new.content, v_link, new.story_id);
  end if;
  return null;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function private.comments_notify();

-- ── 5. Duyệt và gỡ truyện ───────────────────────────────────────────────

-- Giữ nguyên thân hàm của 20261030041209_admin_audit_log.sql, thêm thông báo cho chủ truyện
create or replace function private.admin_set_story_takedown(p_story_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  v_title text;
  v_owner uuid;
begin
  perform private.require_admin();
  update public.stories s
  set taken_down_at = case when v_reason is null then null else coalesce(s.taken_down_at, now()) end,
    takedown_reason = v_reason,
    visibility = case when v_reason is null then s.visibility else 'draft' end,
    -- Gỡ thì mất dấu đã duyệt (truyện chờ duyệt cũng rời hàng chờ); khôi phục không đổi
    review_status = case when v_reason is null then s.review_status end,
    review_submitted_at = case when v_reason is null then s.review_submitted_at end,
    reviewed_at = case when v_reason is null then s.reviewed_at end,
    review_reason = case when v_reason is null then s.review_reason end
  where s.id = p_story_id
  returning s.title, s.owner_id into v_title, v_owner;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform private.admin_log(
    case when v_reason is null then 'story.restore' else 'story.takedown' end,
    'story', p_story_id::text, v_title, jsonb_build_object('reason', v_reason));

  if v_owner is not null then
    if v_reason is null then
      perform private.notify(v_owner, 'story.restored',
        'Truyện "' || v_title || '" đã được khôi phục',
        'Bạn có thể gửi duyệt lại để công khai.', '/studio/story/' || p_story_id, p_story_id);
    else
      perform private.notify(v_owner, 'story.takedown',
        'Truyện "' || v_title || '" đã bị gỡ', v_reason,
        '/studio/story/' || p_story_id, p_story_id);
    end if;
  end if;
end;
$$;

create or replace function private.admin_review_story(
  p_story_id uuid, p_approve boolean, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status public.review_status;
  v_title text;
  v_owner uuid;
begin
  perform private.require_admin();
  select s.review_status, s.title, s.owner_id into v_status, v_title, v_owner
  from public.stories s where s.id = p_story_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_status is distinct from 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  if p_approve then
    -- stories_check_publish đặt published_at; truyện chờ duyệt luôn còn chương đã xuất bản
    update public.stories
    set review_status = 'approved', reviewed_at = now(), review_reason = null,
      visibility = 'published'
    where id = p_story_id;
    perform private.admin_log('story.approve', 'story', p_story_id::text, v_title);
    if v_owner is not null then
      perform private.notify(v_owner, 'story.approved',
        'Truyện "' || v_title || '" đã được duyệt', 'Truyện đã công khai cho người đọc.',
        '/studio/story/' || p_story_id, p_story_id);
    end if;
  else
    if v_reason is null then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    update public.stories
    set review_status = 'rejected', reviewed_at = now(), review_reason = left(v_reason, 500)
    where id = p_story_id;
    perform private.admin_log('story.reject', 'story', p_story_id::text, v_title,
      jsonb_build_object('reason', left(v_reason, 500)));
    if v_owner is not null then
      perform private.notify(v_owner, 'story.rejected',
        'Truyện "' || v_title || '" chưa được duyệt', left(v_reason, 300),
        '/studio/story/' || p_story_id, p_story_id);
    end if;
  end if;
end;
$$;

-- ── 6. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function
  private.notify(uuid, text, text, text, text, uuid),
  private.blocked_between(uuid, uuid),
  private.notify_new_chapters(jsonb),
  private.comments_notify(),
  private.chapters_push_on_insert(),
  private.chapters_push_on_update(),
  private.admin_set_story_takedown(uuid, text),
  private.admin_review_story(uuid, boolean, text)
from public, anon, authenticated;

grant execute on function
  private.admin_set_story_takedown(uuid, text),
  private.admin_review_story(uuid, boolean, text)
to authenticated;
