-- Hộp thư và báo lỗi chương trong khu Quản trị: thêm ô tìm không dấu
-- (plan: documents/plan-bang-quan-tri-loc-sap-xep.md). Lọc theo chủ đề / lý do, sắp xếp và phân
-- trang do PostgREST làm trên kết quả của hàm, nên ở đây chỉ thêm p_query.
-- Tham số mới có mặc định: bản app cũ gọi chỉ với p_status vẫn chạy.

drop function public.admin_contact_messages(text);
drop function private.admin_contact_messages(text);
drop function public.admin_reports(public.report_status);
drop function private.admin_reports(public.report_status);

-- p_status: open | handled | null (tất cả); p_query: tìm theo tên, email, nội dung. Mới trước.
create function private.admin_contact_messages(p_status text, p_query text)
returns table (
  id bigint,
  user_id uuid,
  name text,
  email text,
  topic public.contact_topic,
  message text,
  created_at timestamptz,
  handled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.slugify(coalesce(p_query, ''));
begin
  perform private.require_admin();
  return query
  select m.id, m.user_id, m.name, m.email, m.topic, m.message, m.created_at, m.handled_at
  from public.contact_messages m
  where (p_status is null
      or (p_status = 'open' and m.handled_at is null)
      or (p_status = 'handled' and m.handled_at is not null))
    and (v_q = ''
      or strpos(public.slugify(m.name), v_q) > 0
      or strpos(public.slugify(m.email), v_q) > 0
      or strpos(public.slugify(m.message), v_q) > 0)
  order by m.created_at desc, m.id desc;
end;
$$;

-- p_status: open | resolved | null (tất cả); p_query: tìm theo tên truyện, ghi chú, người báo.
create function private.admin_reports(p_status public.report_status, p_query text)
returns table (
  id uuid,
  story_id uuid,
  story_slug text,
  story_title text,
  story_visibility public.publication_status,
  chapter_number integer,
  chapter_title text,
  reason public.report_reason,
  note text,
  status public.report_status,
  reporter_id uuid,
  reporter_name text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := public.slugify(coalesce(p_query, ''));
begin
  perform private.require_admin();
  return query
  select
    r.id, s.id, s.slug, s.title, s.visibility, r.chapter_number, c.title, r.reason, r.note,
    r.status, r.reporter_id, p.display_name, r.created_at, r.resolved_at
  from public.chapter_reports r
  join public.stories s on s.id = r.story_id
  join public.chapters c on c.story_id = r.story_id and c.number = r.chapter_number
  join public.profiles p on p.id = r.reporter_id
  where (p_status is null or r.status = p_status)
    and (v_q = ''
      or strpos(s.search_title, v_q) > 0
      or strpos(public.slugify(r.note), v_q) > 0
      or strpos(public.slugify(p.display_name), v_q) > 0)
  order by r.created_at desc, r.id;
end;
$$;

-- ── Lớp vỏ ở public ─────────────────────────────────────────────────────

create function public.admin_contact_messages(
  p_status text default null,
  p_query text default null
)
returns table (
  id bigint,
  user_id uuid,
  name text,
  email text,
  topic public.contact_topic,
  message text,
  created_at timestamptz,
  handled_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_contact_messages(p_status, p_query)
$$;

create function public.admin_reports(
  p_status public.report_status default null,
  p_query text default null
)
returns table (
  id uuid,
  story_id uuid,
  story_slug text,
  story_title text,
  story_visibility public.publication_status,
  chapter_number integer,
  chapter_title text,
  reason public.report_reason,
  note text,
  status public.report_status,
  reporter_id uuid,
  reporter_name text,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_reports(p_status, p_query)
$$;

-- ── Quyền ───────────────────────────────────────────────────────────────

revoke execute on function
  private.admin_contact_messages(text, text),
  private.admin_reports(public.report_status, text),
  public.admin_contact_messages(text, text),
  public.admin_reports(public.report_status, text)
from public, anon, authenticated;

grant execute on function
  private.admin_contact_messages(text, text),
  private.admin_reports(public.report_status, text),
  public.admin_contact_messages(text, text),
  public.admin_reports(public.report_status, text)
to authenticated;
