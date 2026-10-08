-- Tối ưu tải trang đợt 3 (plan: documents/plan-toi-uu-tai-trang-dot-3.md mục 2).
-- - Hàm bọc *_cards: trả thẳng thẻ truyện (dòng story_cards) cùng kết quả của RPC cũ, client bớt
--   một request. RPC cũ giữ nguyên (app di động đang dùng).
-- - story_cards thêm description_short (danh sách không tải mô tả đầy đủ) và cover_thumb_path.
-- - Ảnh bìa thu nhỏ: stories.cover_thumb_path, hạn mức ảnh không đếm bản nhỏ có ảnh gốc.

-- ── 1. Ảnh bìa thu nhỏ ──────────────────────────────────────────────────

-- null: chưa có bản nhỏ (bìa cũ), thẻ truyện dùng ảnh gốc
alter table public.stories add column cover_thumb_path text;

-- Client ghi bản nhỏ ngay sau create_story / update_story (RPC chỉ nhận cover_path)
grant update (cover_thumb_path) on public.stories to authenticated;

-- Bản nhỏ luôn đi cùng ảnh gốc: tên {uuid}-thumb.(webp|jpg) cạnh {uuid}.(webp|jpg). Đổi ảnh gốc mà
-- không ghi bản nhỏ trong cùng lệnh thì bỏ bản nhỏ cũ (thẻ truyện dùng ảnh gốc, không lệch ảnh).
create function private.stories_cover_thumb()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.cover_path is distinct from old.cover_path
    and new.cover_thumb_path is not distinct from old.cover_thumb_path
  then
    new.cover_thumb_path := null;
  end if;
  if new.cover_thumb_path is not null and (
    new.cover_path is null
    or new.cover_thumb_path !~ '-thumb\.(webp|jpg)$'
    or not starts_with(
      new.cover_thumb_path,
      regexp_replace(new.cover_path, '\.(webp|jpg)$', '') || '-thumb.'
    )
  ) then
    raise exception 'invalid_cover_thumb' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger stories_cover_thumb
  before insert or update of cover_path, cover_thumb_path on public.stories
  for each row execute function private.stories_cover_thumb();

-- Hạn mức ảnh như bản của migration security_hardening (300 đang lưu, 30 mới / 24 giờ), nhưng bản
-- nhỏ ({uuid}-thumb.ext) không tính khi đã có ảnh gốc {uuid}.ext của chính người đó; bản nhỏ không
-- có ảnh gốc thì tính như ảnh thường (không lách hạn mức bằng cách đặt tên -thumb).
create function private.image_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or (
      p_name ~ '-thumb\.(webp|jpg)$'
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'covers'
          and o.name ~ '\.(webp|jpg)$'
          and o.name !~ '-thumb\.(webp|jpg)$'
          and starts_with(o.name, regexp_replace(p_name, '-thumb\.(webp|jpg)$', '') || '.')
      )
    )
    or (
      select count(*) < 300
        and count(*) filter (where o.created_at > now() - interval '1 day') < 30
      from storage.objects o
      where o.bucket_id in ('covers', 'avatars')
        and starts_with(o.name, (select auth.uid())::text || '/')
        and o.name !~ '-thumb\.(webp|jpg)$'
    )
$$;

drop policy images_insert_own on storage.objects;

create policy images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('covers', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.image_upload_allowed(name)
  );

drop function private.image_upload_allowed();

-- ── 2. story_cards: mô tả rút gọn và ảnh bìa nhỏ ────────────────────────

-- Như bản của migration chapter_scheduling, thêm hai cột ở cuối
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
  st.next_chapter_at,
  -- Danh sách chỉ cần đoạn đầu mô tả (thẻ cắt còn 2–3 dòng); trang chi tiết lấy description
  left(s.description, 300) as description_short,
  s.cover_thumb_path
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

-- ── 3. Hàm bọc trả thẳng thẻ truyện ─────────────────────────────────────

-- Đều là INVOKER: RLS của story_cards áp dụng, truyện người gọi không thấy được thì không có dòng
-- (như storiesByIds lọc qua RLS trước đây). `with ordinality` giữ đúng thứ tự của RPC cũ.

create function public.story_ranking_cards(
  p_by text default 'views',
  p_period text default 'week',
  p_limit integer default 50
)
returns table (value numeric, card public.story_cards)
language sql
stable
set search_path = ''
as $$
  select r.value, c
  from public.story_ranking(p_by, p_period, p_limit) with ordinality as r (story_id, value, ord)
  join public.story_cards c on c.id = r.story_id
  order by r.ord
$$;

create function public.related_story_cards(p_slug text, p_limit integer default 6)
returns table (card public.story_cards)
language sql
stable
set search_path = ''
as $$
  select c
  from public.related_stories(p_slug, p_limit) with ordinality as r (story_id, overlap, ord)
  join public.story_cards c on c.id = r.story_id
  order by r.ord
$$;

-- Client sắp xếp (score, view_count, story_id) và phân trang (.range) như search_stories
create function public.search_story_cards(p_query text)
returns table (story_id uuid, score integer, view_count bigint, card public.story_cards)
language sql
stable
set search_path = ''
as $$
  select r.story_id, r.score, r.view_count, c
  from public.search_stories(p_query) r
  join public.story_cards c on c.id = r.story_id
$$;

create function public.library_cards()
returns table (
  story_id uuid,
  followed_at timestamptz,
  seen_chapter integer,
  new_chapters integer,
  card public.story_cards
)
language sql
stable
set search_path = ''
as $$
  select l.story_id, l.followed_at, l.seen_chapter, l.new_chapters, c
  from public.get_library() with ordinality as l (story_id, slug, followed_at, seen_chapter, new_chapters, ord)
  join public.story_cards c on c.id = l.story_id
  order by l.ord
$$;

-- Truyện chọn tay cho trang chủ theo vị trí, chỉ truyện đang công khai và có chương
create function public.curated_story_cards(p_list text)
returns setof public.story_cards
language sql
stable
set search_path = ''
as $$
  select c.*
  from public.curated_stories cs
  join public.story_cards c on c.id = cs.story_id
  where cs.list::text = p_list
    and c.visibility = 'published'
    and c.chapter_count > 0
  order by cs.position, cs.story_id
$$;

-- ── 4. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function
  private.stories_cover_thumb(),
  private.image_upload_allowed(text),
  public.story_ranking_cards(text, text, integer),
  public.related_story_cards(text, integer),
  public.search_story_cards(text),
  public.library_cards(),
  public.curated_story_cards(text)
from public, anon, authenticated;

-- Policy chạy bằng quyền người gọi nên phải được chạy hàm đếm (như bản cũ)
grant execute on function private.image_upload_allowed(text) to authenticated;

grant execute on function
  public.story_ranking_cards(text, text, integer),
  public.related_story_cards(text, integer),
  public.search_story_cards(text),
  public.curated_story_cards(text)
to anon, authenticated;

grant execute on function public.library_cards() to authenticated;
