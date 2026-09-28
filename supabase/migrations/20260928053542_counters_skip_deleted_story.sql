-- Xóa tài khoản (hoặc truyện) cascade xóa cùng lúc truyện, điểm chấm, theo dõi và chương. Trigger
-- đếm chạy sau khi dòng truyện đã mất thì cập nhật story_stats sẽ vi phạm khóa ngoại, làm hỏng cả
-- lệnh xóa. Các trigger đếm giờ bỏ qua khi truyện không còn.

create or replace function private.follows_count()
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
  if tg_op = 'INSERT' then
    update public.story_stats set follower_count = follower_count + 1 where story_id = sid;
  else
    update public.story_stats set follower_count = greatest(follower_count - 1, 0)
    where story_id = sid;
  end if;
  return null;
end;
$$;

create or replace function private.ratings_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
    and exists (select 1 from public.stories s where s.id = old.story_id) then
    update public.story_stats
    set rating_counts[old.score] = greatest(rating_counts[old.score] - 1, 0)
    where story_id = old.story_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE')
    and exists (select 1 from public.stories s where s.id = new.story_id) then
    update public.story_stats
    set rating_counts[new.score] = rating_counts[new.score] + 1
    where story_id = new.story_id;
  end if;
  return null;
end;
$$;

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

  update public.stories set updated_at = now() where id = sid;
  return null;
end;
$$;

revoke execute on function private.follows_count(), private.ratings_count(),
  private.chapters_after_change() from public, anon, authenticated;
