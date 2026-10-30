-- Admin gửi thông báo chung cho mọi tài khoản (plan documents/plan-thong-bao.md, mục 2). Mỗi tài
-- khoản nhận một dòng loại `announcement` trong hộp thông báo; lần gửi được ghi vào nhật ký admin
-- (announcement.send), trang quản trị đọc lại danh sách các lần đã gửi từ nhật ký.

-- ── 1. Gửi thông báo ────────────────────────────────────────────────────

-- Trả về số người nhận. `p_link` rỗng hoặc đường dẫn nội bộ (`/…`, không phải `//host`).
create function private.admin_send_announcement(p_title text, p_body text, p_link text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_count integer;
begin
  perform private.require_admin();

  if char_length(v_title) not between 1 and 120
     or char_length(v_body) > 300
     or (v_link is not null
         and (v_link not like '/%' or v_link like '//%' or char_length(v_link) > 300)) then
    raise exception 'invalid_announcement' using errcode = 'P0001';
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'announcement', v_title, v_body, v_link from public.profiles p;
  get diagnostics v_count = row_count;

  perform private.admin_log(
    'announcement.send', 'announcement', gen_random_uuid()::text, v_title,
    jsonb_build_object('body', v_body, 'link', v_link, 'recipients', v_count));
  return v_count;
end;
$$;

create function public.admin_send_announcement(p_title text, p_body text, p_link text default null)
returns integer
language sql
set search_path = ''
as $$ select private.admin_send_announcement(p_title, p_body, p_link) $$;

-- ── 2. Quyền ────────────────────────────────────────────────────────────

revoke execute on function
  private.admin_send_announcement(text, text, text),
  public.admin_send_announcement(text, text, text)
from public, anon, authenticated;

grant execute on function
  private.admin_send_announcement(text, text, text),
  public.admin_send_announcement(text, text, text)
to authenticated;
