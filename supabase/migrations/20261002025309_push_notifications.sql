-- Thông báo đẩy khi truyện đang theo dõi có chương mới (app di động, qua Expo Push). App đăng ký mã
-- thông báo của máy (push_tokens); chương được xuất bản lần đầu ở truyện công khai thì database gửi
-- thông báo cho người theo dõi (trừ tác giả) bằng pg_net. Một truyện chỉ gửi tối đa một lần mỗi 30
-- phút, để tác giả đăng liền nhiều chương thì người đọc không bị dội thông báo.

create extension if not exists pg_net with schema extensions;

-- ── 1. Mã thông báo của máy ─────────────────────────────────────────────

create table public.push_tokens (
  -- Mã Expo dạng ExponentPushToken[...]
  token text primary key check (char_length(token) between 10 and 255),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
-- Ghi qua register_push_token (máy đổi tài khoản thì mã chuyển chủ); xóa mã của mình khi đăng xuất
grant select, delete on public.push_tokens to authenticated;

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

/** Mỗi tài khoản giữ tối đa bấy nhiêu máy; máy cũ nhất bị bỏ khi vượt */
create function private.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'unauthenticated' using errcode = 'P0001';
  end if;
  -- Một máy chỉ thuộc một tài khoản: đăng nhập tài khoản khác trên cùng máy thì mã chuyển chủ
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, uid, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  delete from public.push_tokens
  where user_id = uid
    and token not in (
      select t.token from public.push_tokens t
      where t.user_id = uid
      order by t.updated_at desc
      limit 10
    );
end;
$$;

create function public.register_push_token(p_token text, p_platform text)
returns void
language sql
set search_path = ''
as $$ select private.register_push_token(p_token, p_platform) $$;

-- ── 2. Gửi thông báo khi có chương mới ──────────────────────────────────

-- Lần gửi gần nhất của từng truyện (chống dội thông báo); không ai đọc ghi qua API
create table private.story_push_log (
  story_id uuid primary key references public.stories (id) on delete cascade,
  sent_at timestamptz not null
);

/** Khoảng cách tối thiểu giữa hai lần gửi thông báo của cùng một truyện */
create function private.push_cooldown()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '30 minutes' $$;

-- Gửi một thông báo cho mỗi truyện công khai có chương vừa xuất bản lần đầu (`chapters`: mảng
-- {story_id, number, title}), báo chương mới nhất trong số đó, tới mọi máy của người theo dõi trừ tác
-- giả. Expo Push nhận tối đa 100 tin mỗi lần gọi.
create function private.send_chapter_push(chapters jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  batch jsonb;
begin
  for item in
    select
      s.id as story_id,
      s.slug,
      s.title as story_title,
      count(*)::integer as new_count,
      (array_agg(c.number order by c.number desc))[1] as number,
      (array_agg(c.title order by c.number desc))[1] as title
    from jsonb_to_recordset(chapters) as c (story_id uuid, number integer, title text)
    join public.stories s on s.id = c.story_id
    where s.visibility = 'published'
    group by s.id, s.slug, s.title
  loop
    -- Vừa gửi cho truyện này thì thôi
    if exists (
      select 1 from private.story_push_log l
      where l.story_id = item.story_id and l.sent_at > now() - private.push_cooldown()
    ) then
      continue;
    end if;
    insert into private.story_push_log (story_id, sent_at)
    values (item.story_id, now())
    on conflict (story_id) do update set sent_at = excluded.sent_at;

    for batch in
      select jsonb_agg(m.message)
      from (
        select
          jsonb_build_object(
            'to', t.token,
            'title', item.story_title,
            'body',
              case
                when item.new_count > 1 then
                  item.new_count || ' chương mới, mới nhất chương ' || item.number
                when item.title <> '' then 'Chương ' || item.number || ': ' || item.title
                else 'Chương ' || item.number
              end,
            'sound', 'default',
            -- App mở đúng chương (đường dẫn trong app, như link web)
            'data', jsonb_build_object(
              'url', '/story/' || item.slug || '/chapter-' || item.number
            )
          ) as message,
          (row_number() over (order by t.token) - 1) / 100 as chunk
        from public.follows f
        join public.push_tokens t on t.user_id = f.user_id
        join public.stories s on s.id = f.story_id
        where f.story_id = item.story_id
          and f.user_id is distinct from s.owner_id
      ) m
      group by m.chunk
    loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := batch,
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
      );
    end loop;
  end loop;
end;
$$;

-- Thêm chương đã xuất bản
create function private.chapters_push_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send_chapter_push(
    (select jsonb_agg(jsonb_build_object('story_id', n.story_id, 'number', n.number, 'title', n.title))
     from new_rows n where n.status = 'published')
  );
  return null;
end;
$$;

-- Sửa chương: chỉ chương xuất bản lần đầu (trước đó chưa từng có published_at)
create function private.chapters_push_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send_chapter_push(
    (select jsonb_agg(jsonb_build_object('story_id', n.story_id, 'number', n.number, 'title', n.title))
     from new_rows n
     join old_rows o on o.id = n.id
     where n.status = 'published' and o.published_at is null)
  );
  return null;
end;
$$;

-- Transition table chỉ dùng được với trigger một sự kiện: tách thêm mới và sửa
create trigger chapters_notify_insert
  after insert on public.chapters
  referencing new table as new_rows
  for each statement execute function private.chapters_push_on_insert();

create trigger chapters_notify_update
  after update on public.chapters
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.chapters_push_on_update();

-- ── 3. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function
  private.register_push_token(text, text),
  public.register_push_token(text, text),
  private.push_cooldown(),
  private.send_chapter_push(jsonb),
  private.chapters_push_on_insert(),
  private.chapters_push_on_update()
from public, anon, authenticated;

grant execute on function
  private.register_push_token(text, text),
  public.register_push_token(text, text)
to authenticated;
