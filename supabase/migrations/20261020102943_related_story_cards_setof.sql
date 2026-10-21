-- related_story_cards khai báo `returns table (card public.story_cards)`: bảng một cột kiểu dòng
-- được Postgres coi là `setof story_cards`, nên PostgREST trả các cột của thẻ nằm phẳng, không có
-- cột `card`. Khai báo lại cho đúng (như curated_story_cards). Dữ liệu trả về không đổi.
-- Đổi kiểu trả về phải drop rồi tạo lại hàm.

-- ── 1. Hàm ──────────────────────────────────────────────────────────────

drop function public.related_story_cards(text, integer);

create function public.related_story_cards(p_slug text, p_limit integer default 6)
returns setof public.story_cards
language sql
stable
set search_path = ''
as $$
  select c.*
  from public.related_stories(p_slug, p_limit) with ordinality as r (story_id, overlap, ord)
  join public.story_cards c on c.id = r.story_id
  order by r.ord
$$;

-- ── 2. Quyền chạy hàm ───────────────────────────────────────────────────

revoke execute on function public.related_story_cards(text, integer)
from public, anon, authenticated;

grant execute on function public.related_story_cards(text, integer) to anon, authenticated;
