-- Sửa theo `supabase db advisors` sau lần push đầu:
-- 1. record_chapter_view: phần chạy quyền cao (DEFINER) chuyển sang schema private, không lộ ra API;
--    hàm ở public chỉ còn là lớp vỏ SECURITY INVOKER để khách vẫn gọi được qua /rest/v1/rpc.
-- 2. Gộp các policy permissive trùng role + hành động (Postgres phải chạy mọi policy cho từng dòng).
-- 3. Index cho khóa ngoại ghép (story_id, chapter_number) của chapter_reports.

-- ── 1. record_chapter_view ──────────────────────────────────────────────

-- Hàm mới tạo trong private không tự cấp quyền chạy cho PUBLIC
alter default privileges in schema private revoke execute on functions from public;

drop function public.record_chapter_view(text, integer);

-- Ghi 1 lượt đọc chương đã xuất bản; không tính lượt của chính tác giả. DEFINER vì khách cũng ghi
-- được mà không được phép sửa thẳng bảng số liệu. Chống đếm trùng hiện nằm ở client.
create function private.record_chapter_view(p_slug text, p_number integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
begin
  select s.id into v_story_id
  from public.stories s
  join public.chapters c on c.story_id = s.id
  where s.slug = p_slug
    and s.visibility = 'published'
    and s.owner_id is distinct from (select auth.uid())
    and c.number = p_number
    and c.status = 'published';
  if v_story_id is null then
    return;
  end if;

  insert into public.chapter_views as cv (story_id, chapter_number, day, views)
  values (v_story_id, p_number, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 1)
  on conflict (story_id, chapter_number, day) do update set views = cv.views + 1;

  update public.story_stats set view_count = view_count + 1 where story_id = v_story_id;
end;
$$;

create function public.record_chapter_view(p_slug text, p_number integer)
returns void
language sql
set search_path = ''
as $$
  select private.record_chapter_view(p_slug, p_number)
$$;

-- Lớp vỏ chạy bằng quyền người gọi nên anon/authenticated cần USAGE trên private và quyền chạy đúng
-- hàm này (private không lộ ra Data API nên không gọi thẳng được từ client)
grant usage on schema private to anon, authenticated;
revoke execute on function private.record_chapter_view(text, integer) from public, anon, authenticated;
grant execute on function private.record_chapter_view(text, integer) to anon, authenticated;

revoke execute on function public.record_chapter_view(text, integer) from public, anon, authenticated;
grant execute on function public.record_chapter_view(text, integer) to anon, authenticated;

-- ── 2. Gộp policy ───────────────────────────────────────────────────────

drop policy chapters_select_published on public.chapters;
drop policy chapters_select_own on public.chapters;

-- Người đọc: chương đã xuất bản của truyện công khai. Chủ truyện: mọi chương (cả nháp).
-- RLS của stories áp trong exists nên người lạ chỉ thấy được truyện công khai.
create policy chapters_select_visible on public.chapters
  for select to anon, authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = chapters.story_id
      and (
        (s.visibility = 'published' and chapters.status = 'published')
        or s.owner_id = (select auth.uid())
      )
  ));

drop policy chapter_reports_update_story_owner on public.chapter_reports;
drop policy chapter_reports_update_reporter on public.chapter_reports;

-- Chủ truyện đổi trạng thái; người gửi sửa ghi chú báo lỗi còn mở của mình (report_chapter)
create policy chapter_reports_update_involved on public.chapter_reports
  for update to authenticated
  using (
    (reporter_id = (select auth.uid()) and status = 'open')
    or exists (
      select 1 from public.stories s
      where s.id = chapter_reports.story_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    (reporter_id = (select auth.uid()) and status = 'open')
    or exists (
      select 1 from public.stories s
      where s.id = chapter_reports.story_id and s.owner_id = (select auth.uid())
    )
  );

-- ── 3. Index cho khóa ngoại ghép ────────────────────────────────────────

create index chapter_reports_story_chapter_idx
  on public.chapter_reports (story_id, chapter_number);
