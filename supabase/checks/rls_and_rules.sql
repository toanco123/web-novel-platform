-- Kiểm tra RLS, quyền và luật nghiệp vụ của schema. Chạy trong transaction rồi ROLLBACK nên không để
-- lại dữ liệu:  supabase db query --linked -f supabase/checks/rls_and_rules.sql
-- Không báo lỗi = mọi kiểm tra đều qua; kiểm tra sai sẽ ném lỗi bắt đầu bằng "FAIL".
-- (Không để trong supabase/tests vì thư mục đó dành cho pgTAP của `supabase test db`.)

begin;

create function pg_temp.expect(ok boolean, what text)
returns void
language plpgsql
as $$
begin
  if ok is not true then
    raise exception 'FAIL: %', what;
  end if;
end;
$$;

-- expected: mã SQLSTATE (vd 23505) hoặc một đoạn trong thông báo lỗi (vd last_published_chapter)
create function pg_temp.expect_error(stmt text, expected text)
returns void
language plpgsql
as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected or strpos(sqlerrm, expected) > 0 then
      return;
    end if;
    raise exception 'FAIL: "%" báo lỗi % (%), mong đợi %', stmt, sqlerrm, sqlstate, expected;
  end;
  raise exception 'FAIL: "%" không báo lỗi, mong đợi %', stmt, expected;
end;
$$;

-- Số dòng một câu lệnh ghi thực sự tác động (RLS chặn update/delete thì là 0, không báo lỗi)
create function pg_temp.affected(stmt text)
returns bigint
language plpgsql
as $$
declare
  n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end;
$$;

create function pg_temp.story_id(p_slug text)
returns uuid
language sql
as $$ select id from public.stories where slug = p_slug $$;

-- Quản trị viên duyệt truyện của tác giả thường (cho các đoạn cần truyện công khai). Gọi sau
-- `reset role` (quyền chủ phiên) rồi `set local role authenticated` lại; JWT giữ nguyên.
create function pg_temp.approve(p_slug text)
returns void
language sql
as $$
  update public.stories
  set review_status = 'approved', reviewed_at = now(), review_reason = null,
    visibility = 'published'
  where slug = p_slug
$$;

-- DB thật đã có dữ liệu: các phép đếm trên toàn bảng bỏ qua truyện có từ trước khi kiểm tra
create temp table existing_stories as select id from public.stories;
grant select on existing_stories to anon, authenticated;


-- ── Tài khoản: trigger tạo hồ sơ ────────────────────────────────────────

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'a@kiem-tra.local', '{"display_name": "Tác giả A"}'),
  ('00000000-0000-4000-8000-00000000000b', 'b@kiem-tra.local',
    '{"full_name": "Người đọc B có cái tên dài hơn ba mươi ký tự"}'),
  ('00000000-0000-4000-8000-00000000000c', 'khach-c@kiem-tra.local', '{}');

select pg_temp.expect(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a')
    = 'Tác giả A',
  'hồ sơ lấy display_name từ form đăng ký');
select pg_temp.expect(
  (select char_length(display_name) from public.profiles
    where id = '00000000-0000-4000-8000-00000000000b') <= 30,
  'tên từ OAuth bị cắt còn 30 ký tự');
select pg_temp.expect(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000c')
    = 'khach-c',
  'không có tên thì lấy phần trước @ của email');

select pg_temp.expect(public.slugify('Ngôn Tình Đô Thị!') = 'ngon-tinh-do-thi', 'slugify');
select pg_temp.expect(public.slugify('  Đường  về   ') = 'duong-ve', 'slugify bỏ khoảng trắng');

-- ── Tác giả A: thể loại, tạo truyện, chương ────────────────────────────

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

insert into public.genres (name) values
  ('Ngôn tình'), ('Cổ đại'), ('Thể loại 3'), ('Thể loại 4'), ('Thể loại 5'), ('Thể loại 6');
select pg_temp.expect(
  exists (select 1 from public.genres where slug = 'ngon-tinh'
    and created_by = '00000000-0000-4000-8000-00000000000a'),
  'slug thể loại do DB đặt, created_by = người tạo');
select pg_temp.expect_error($$insert into public.genres (name) values ('NGÔN TÌNH')$$, '23505');

select * from public.create_story(
  'Trường An Không Tuyết', 'Giới thiệu truyện đủ dài để qua kiểm tra.', 'ongoing',
  array['ngon-tinh', 'co-dai', 'ngon-tinh'], null,
  '{"title": "Mở đầu", "content": "Nội dung chương một."}', true);

select pg_temp.expect(
  (select visibility = 'draft' and review_status = 'pending' and review_submitted_at is not null
    from public.stories where slug = 'truong-an-khong-tuyet'),
  'create_story đăng luôn (tác giả thường): chương đầu xuất bản, truyện chờ duyệt');
select pg_temp.expect_error(
  $$update public.stories set visibility = 'published' where slug = 'truong-an-khong-tuyet'$$,
  'story_not_approved');
select pg_temp.expect_error(
  $$update public.stories set review_status = 'approved' where slug = 'truong-an-khong-tuyet'$$,
  '42501');
select pg_temp.expect_error(
  $$select public.submit_story_for_review(pg_temp.story_id('truong-an-khong-tuyet'))$$,
  'already_pending');
select pg_temp.expect_error(
  $$update public.chapters set status = 'draft'
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 1$$,
  'last_published_chapter');
reset role;
select pg_temp.approve('truong-an-khong-tuyet');
set local role authenticated;
select pg_temp.expect(
  (select visibility = 'published' and published_at is not null from public.stories
    where slug = 'truong-an-khong-tuyet'),
  'duyệt xong thì truyện công khai');
select pg_temp.expect(
  (select chapter_count = 1 and first_chapter_number = 1 and latest_chapter_title = 'Mở đầu'
    from public.story_cards where slug = 'truong-an-khong-tuyet'),
  'story_stats có chương đầu');
select pg_temp.expect(
  (select genre_slugs = array['ngon-tinh', 'co-dai'] from public.story_cards
    where slug = 'truong-an-khong-tuyet'),
  'thể loại giữ thứ tự chọn và bỏ trùng');

select * from public.create_story(
  'Trường An Không Tuyết', 'Bản nháp trùng tên.', 'ongoing', array['co-dai']);
select pg_temp.expect(
  (select visibility = 'draft' from public.stories where slug = 'truong-an-khong-tuyet-2'),
  'trùng tên thì slug thêm -2, chưa có chương thì là nháp');
select pg_temp.expect_error(
  $$update public.stories set visibility = 'published' where slug = 'truong-an-khong-tuyet-2'$$,
  'no_published_chapters');
select pg_temp.expect_error(
  $$select public.update_story(pg_temp.story_id('truong-an-khong-tuyet-2'), 'Tên mới', '', 'ongoing',
    array['ngon-tinh', 'co-dai', 'the-loai-3', 'the-loai-4', 'the-loai-5', 'the-loai-6'])$$,
  'too_many_genres');

insert into public.chapters (story_id, number, title, content, status) values
  (pg_temp.story_id('truong-an-khong-tuyet'), 3, 'Chương ba', 'Nội dung ba.', 'published'),
  (pg_temp.story_id('truong-an-khong-tuyet'), 5, 'Chương nháp', 'Nội dung nháp.', 'draft');

select pg_temp.expect(
  (select chapter_count = 2 and latest_chapter_number = 3 from public.story_cards
    where slug = 'truong-an-khong-tuyet'),
  'số chương chỉ tính chương đã xuất bản');
select pg_temp.expect_error(
  $$insert into public.chapters (story_id, number, content)
    values (pg_temp.story_id('truong-an-khong-tuyet'), 3, 'Trùng số')$$,
  '23505');
select pg_temp.expect_error(
  $$update public.chapters set number = 30
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 3$$,
  'chapter_number_locked');
select pg_temp.expect(
  pg_temp.affected($$update public.chapters set number = 4
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 5$$) = 1,
  'chương nháp chưa xuất bản lần nào thì đổi số được');

-- Nội dung có định dạng (HTML rút gọn) được dài hơn 100.000 ký tự, tối đa 200.000
select pg_temp.expect(
  pg_temp.affected($$insert into public.chapters (story_id, number, content)
    values (pg_temp.story_id('truong-an-khong-tuyet'), 6,
      '<p><strong>' || repeat('x', 150000) || '</strong></p>')$$) = 1,
  'chương 150.000 ký tự (có thẻ định dạng) lưu được');
select pg_temp.expect_error(
  $$insert into public.chapters (story_id, number, content)
    values (pg_temp.story_id('truong-an-khong-tuyet'), 7, repeat('x', 200001))$$,
  '23514');

-- Quyền theo cột: không sửa được slug, số liệu, mốc xuất bản
select pg_temp.expect_error(
  $$update public.stories set slug = 'doi-slug' where slug = 'truong-an-khong-tuyet'$$, '42501');
select pg_temp.expect_error(
  $$update public.story_stats set view_count = 999999$$, '42501');
select pg_temp.expect_error(
  $$insert into public.chapters (story_id, number, content, published_at)
    values (pg_temp.story_id('truong-an-khong-tuyet'), 9, 'x', now())$$,
  '42501');

select pg_temp.expect(
  (select count(*) = 2 from public.studio_stories), 'studio_stories: A thấy 2 truyện của mình');

-- ── Người đọc B ─────────────────────────────────────────────────────────

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;

select pg_temp.expect(
  (select count(*) = 1 from public.story_cards where slug like 'truong-an-khong-tuyet%'),
  'B thấy truyện công khai, không thấy nháp của A');
select pg_temp.expect(
  (select array_agg(number order by number) = array[1, 3] from public.chapters
    where story_id = pg_temp.story_id('truong-an-khong-tuyet')),
  'B chỉ thấy chương đã xuất bản');
select pg_temp.expect(
  (select count(*) = 0 from public.studio_stories), 'studio_stories: B không thấy truyện của A');
select pg_temp.expect(
  pg_temp.affected($$update public.stories set title = 'Bị sửa' where slug = 'truong-an-khong-tuyet'$$)
    = 0,
  'B không sửa được truyện của A');
select pg_temp.expect(
  pg_temp.affected($$delete from public.chapters
    where story_id = pg_temp.story_id('truong-an-khong-tuyet')$$) = 0,
  'B không xóa được chương của A');
select pg_temp.expect_error(
  $$insert into public.chapters (story_id, number, content)
    values (pg_temp.story_id('truong-an-khong-tuyet'), 50, 'Chen chương')$$,
  '42501');
select pg_temp.expect_error(
  $$select public.studio_story_stats(pg_temp.story_id('truong-an-khong-tuyet'))$$, 'not_found');

-- Theo dõi và số chương mới
insert into public.follows (story_id) values (pg_temp.story_id('truong-an-khong-tuyet'));
select pg_temp.expect(
  (select seen_chapter = 3 from public.follows), 'theo dõi thì mốc đã thấy = chương mới nhất');
select pg_temp.expect(
  (select follower_count = 1 from public.story_cards where slug = 'truong-an-khong-tuyet'),
  'follower_count tăng');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
update public.chapters set status = 'published'
where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 4;

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;

select pg_temp.expect(
  (select new_chapters = 1 from public.get_library()), 'get_library đếm 1 chương mới');
select pg_temp.expect(public.library_update_count() = 1, 'library_update_count = 1');

select public.save_reading_progress('truong-an-khong-tuyet', 4, 'Chương nháp', 0.5);
select pg_temp.expect(
  (select new_chapters = 0 from public.get_library()), 'đọc tới chương mới thì hết chương mới');
select public.save_reading_progress('truong-an-khong-tuyet', 4, 'Chương nháp');
select pg_temp.expect(
  (select progress = 0.5 from public.reading_history), 'không truyền progress thì giữ vị trí cũ');
select public.merge_guest_history(
  '[{"slug": "truong-an-khong-tuyet", "chapter": 1, "chapterTitle": "Mở đầu", "progress": 0.1,
     "readAt": "2020-01-01T00:00:00Z"},
    {"slug": "khong-co-truyen-nay", "chapter": 1, "readAt": "2020-01-01T00:00:00Z"}]');
select pg_temp.expect(
  (select chapter_number = 4 from public.reading_history),
  'gộp lịch sử khách không đè bản mới hơn');

-- Chấm điểm
insert into public.ratings (story_id, score) values (pg_temp.story_id('truong-an-khong-tuyet'), 5);
insert into public.ratings (story_id, score) values (pg_temp.story_id('truong-an-khong-tuyet'), 3)
on conflict (user_id, story_id) do update set score = excluded.score;
select pg_temp.expect(
  (select rating_counts = array[0, 0, 1, 0, 0] and rating_count = 1 and rating_avg = 3
    from public.story_cards where slug = 'truong-an-khong-tuyet'),
  'đổi điểm thì phân bố sao cập nhật đúng');

-- Bình luận
insert into public.comments (story_id, content)
values (pg_temp.story_id('truong-an-khong-tuyet'), 'Hay quá');
insert into public.comments (story_id, chapter_number, content)
values (pg_temp.story_id('truong-an-khong-tuyet'), 1, 'Chương mở đầu cuốn');
select pg_temp.expect_error(
  $$insert into public.comments (story_id, chapter_number, content)
    values (pg_temp.story_id('truong-an-khong-tuyet'), 99, 'Chương không có')$$,
  '42501');

-- Lượt đọc
select public.record_chapter_view('truong-an-khong-tuyet', 1);
select public.record_chapter_view('truong-an-khong-tuyet', 999);
select pg_temp.expect(
  (select view_count = 1 from public.story_cards where slug = 'truong-an-khong-tuyet'),
  'record_chapter_view: B đọc thì +1, chương không có thì bỏ qua');

-- Báo lỗi
select public.report_chapter('truong-an-khong-tuyet', 1, 'typo', 'Sai chính tả');
select public.report_chapter('truong-an-khong-tuyet', 1, 'typo', 'Sai chính tả dòng 3');
select pg_temp.expect(
  (select count(*) = 1 and min(note) = 'Sai chính tả dòng 3' from public.chapter_reports),
  'báo lại cùng lý do thì chỉ cập nhật ghi chú');
select pg_temp.expect_error(
  $$select public.report_chapter('truong-an-khong-tuyet', 1, 'other', '')$$, '23514');
select pg_temp.expect_error(
  $$update public.chapter_reports set status = 'resolved'$$, '42501');

-- B đăng một truyện cùng thể loại (cho truyện liên quan và đếm thể loại)
select * from public.create_story(
  'Hoa Nở Năm Ấy', 'Truyện của B.', 'completed', array['ngon-tinh'], null,
  '{"number": 50, "title": "Chương 50", "content": "Đăng tiếp từ nơi khác."}', true);
reset role;
select pg_temp.approve('hoa-no-nam-ay');
set local role authenticated;
select pg_temp.expect(
  (select first_chapter_number = 50 from public.story_cards where slug = 'hoa-no-nam-ay'),
  'chương đầu tiên được chọn số');

-- ── Tác giả A: thống kê, báo lỗi, luật chương công khai cuối ─────────────

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

select public.record_chapter_view('truong-an-khong-tuyet', 1);
select pg_temp.expect(
  (select view_count = 1 from public.story_cards where slug = 'truong-an-khong-tuyet'),
  'lượt đọc của chính tác giả không tính');

select pg_temp.expect(
  (select (s ->> 'views')::int = 1
      and jsonb_array_length(s -> 'viewsByDay') = 7
      and (s -> 'viewsByDay' -> 6 ->> 'views')::int = 1
      and jsonb_array_length(s -> 'viewsByChapter') = 3
      and (s ->> 'followers')::int = 1
      and (s ->> 'comments')::int = 2
    from public.studio_story_stats(pg_temp.story_id('truong-an-khong-tuyet')) as s),
  'studio_story_stats');
select pg_temp.expect(
  (select open_reports = 1 from public.studio_stories where slug = 'truong-an-khong-tuyet'),
  'studio_stories đếm báo lỗi chưa xử lý');
select pg_temp.expect(
  pg_temp.affected($$update public.chapter_reports set status = 'resolved'$$) = 1,
  'chủ truyện đánh dấu đã xử lý');
select pg_temp.expect(
  (select resolved_at is not null from public.chapter_reports), 'resolved_at được đặt');

select pg_temp.expect(
  (select count(*) = 1 from public.search_stories('truong an') s where s.score = 4),
  'tìm theo đầu tên, không dấu');
select pg_temp.expect(
  (select score = 2 from public.search_stories('khong truong')), 'tìm theo đủ các từ');
select pg_temp.expect(
  (select count(*) = 1 from public.search_stories('tac gia a') s where s.score = 1),
  'tìm theo tên tác giả');
select pg_temp.expect(
  (select count(*) = 1 from public.story_ranking('views', 'week')), 'xếp hạng lượt đọc tuần');
select pg_temp.expect(
  (select value = 3 from public.story_ranking('rating', 'all')), 'xếp hạng điểm trả điểm thật');
select pg_temp.expect(
  (select count(*) = 1 from public.story_ranking('follows', 'all')), 'xếp hạng theo dõi');
select pg_temp.expect_error($$select * from public.story_ranking('abc', 'week')$$, 'invalid_ranking');
select pg_temp.expect(
  (select story_id = pg_temp.story_id('hoa-no-nam-ay')
    from public.related_stories('truong-an-khong-tuyet')),
  'truyện liên quan: cùng thể loại, khác tác giả');
select pg_temp.expect(
  (select story_count = 2 from public.genre_cards where slug = 'ngon-tinh'),
  'genre_cards đếm truyện công khai');

update public.chapters set status = 'draft'
where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number in (3, 4);
select pg_temp.expect_error(
  $$update public.chapters set status = 'draft'
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 1$$,
  'last_published_chapter');
select pg_temp.expect_error(
  $$delete from public.chapters
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 1$$,
  'last_published_chapter');

update public.stories set visibility = 'draft' where slug = 'truong-an-khong-tuyet';
delete from public.chapters where story_id = pg_temp.story_id('truong-an-khong-tuyet') and number = 1;

reset role;
select pg_temp.expect(
  (select count(*) = 0 from public.comments
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and chapter_number = 1)
  and (select count(*) = 0 from public.chapter_reports
    where story_id = pg_temp.story_id('truong-an-khong-tuyet'))
  and (select count(*) = 0 from public.chapter_views
    where story_id = pg_temp.story_id('truong-an-khong-tuyet')),
  'xóa chương thì xóa bình luận, báo lỗi, lượt đọc của chương');
select pg_temp.expect(
  (select count(*) = 1 from public.comments
    where story_id = pg_temp.story_id('truong-an-khong-tuyet') and chapter_number is null),
  'bình luận của cả truyện vẫn còn');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect(
  pg_temp.affected($$delete from public.stories where slug = 'truong-an-khong-tuyet'$$) = 1,
  'xóa truyện nháp');
-- Truyện đang công khai với đúng 1 chương công khai: cascade xóa chương không bị luật
-- "chương công khai cuối" chặn
select * from public.create_story(
  'Truyện Xóa Thử', 'Để thử xóa.', 'ongoing', array['co-dai'], null,
  '{"title": "Một", "content": "Chương duy nhất."}', true);
reset role;
select pg_temp.approve('truyen-xoa-thu');
set local role authenticated;
select pg_temp.expect(
  pg_temp.affected($$delete from public.stories where slug = 'truyen-xoa-thu'$$) = 1,
  'xóa truyện đang công khai không bị trigger chương chặn');

-- ── Khách (anon) ────────────────────────────────────────────────────────

reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select pg_temp.expect(
  (select count(*) = 1 from public.story_cards
    where id not in (select id from existing_stories)),
  'khách thấy truyện công khai');
select pg_temp.expect(
  (select count(*) = 1 from public.chapters
    where story_id not in (select id from existing_stories)),
  'khách thấy chương đã xuất bản');
select public.record_chapter_view('hoa-no-nam-ay', 50);
select pg_temp.expect(
  (select view_count = 1 from public.story_cards where slug = 'hoa-no-nam-ay'),
  'khách cũng ghi được lượt đọc');
insert into public.contact_messages (name, email, topic, message)
values ('Khách', 'khach@example.com', 'general', 'Góp ý cho trang web.');
select pg_temp.expect_error($$select * from public.contact_messages$$, '42501');
select pg_temp.expect_error($$select * from public.follows$$, '42501');
select pg_temp.expect_error($$select * from public.studio_stories$$, '42501');
select pg_temp.expect_error(
  $$insert into public.comments (story_id, content)
    values (pg_temp.story_id('hoa-no-nam-ay'), 'Khách viết')$$,
  '42501');
select pg_temp.expect_error($$select public.get_library()$$, '42501');

-- ── Xóa tài khoản: cascade truyện đang có người khác chấm điểm, theo dõi ──

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
insert into public.ratings (story_id, score) values (pg_temp.story_id('hoa-no-nam-ay'), 4);
insert into public.follows (story_id) values (pg_temp.story_id('hoa-no-nam-ay'));

reset role;
select pg_temp.expect(
  pg_temp.affected($$delete from auth.users where id = '00000000-0000-4000-8000-00000000000b'$$)
    = 1,
  'xóa tài khoản kéo theo truyện, điểm chấm, theo dõi không bị trigger đếm chặn');
select pg_temp.expect(
  (select count(*) = 0 from public.stories where slug = 'hoa-no-nam-ay'),
  'truyện của tài khoản bị xóa cũng bị xóa');

-- ── Trang quản trị: chỉ quản trị viên (app_metadata.role = admin) gọi được ──

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select pg_temp.expect_error($$select public.admin_overview(30)$$, '42501');
select pg_temp.expect_error($$select * from public.admin_users()$$, '42501');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect_error($$select public.admin_overview(30)$$, 'forbidden');
select pg_temp.expect_error($$select * from public.admin_users()$$, 'forbidden');
select pg_temp.expect_error($$select * from public.admin_stories()$$, 'forbidden');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select pg_temp.expect(
  (select count(*) = 1 from public.admin_users('tac gia a')
    where email = 'a@kiem-tra.local' and display_name = 'Tác giả A'),
  'quản trị viên thấy email người dùng, tìm được theo tên không dấu');
select pg_temp.expect(
  exists (select 1 from public.admin_stories(p_visibility => 'draft')
    where slug = 'truong-an-khong-tuyet-2'),
  'quản trị viên thấy truyện nháp của người khác');
select pg_temp.expect(
  (select (o -> 'totals' ->> 'draftStories')::integer >= 1
      and jsonb_array_length(o -> 'days') = 7
    from public.admin_overview(7) as o),
  'admin_overview có tổng số và đủ 7 ngày');

reset role;

-- ── Chống spam: lượt đọc, bình luận, liên hệ ────────────────────────────

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
select * from public.create_story(
  'Truyện Chống Spam', 'Truyện để kiểm tra giới hạn tần suất.', 'ongoing', array['co-dai'], null,
  '{"title": "Một", "content": "Nội dung chương một."}', true);
reset role;
select pg_temp.approve('truyen-chong-spam');
set local role authenticated;

-- C đọc cùng một chương nhiều lần trong ngày chỉ tính 1 lượt
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);
set local role authenticated;
select public.record_chapter_view('truyen-chong-spam', 1);
select public.record_chapter_view('truyen-chong-spam', 1);
select pg_temp.expect(
  (select view_count = 1 from public.story_cards where slug = 'truyen-chong-spam'),
  'một người đọc lại cùng chương trong ngày chỉ tính 1 lượt');

-- Bình luận: gửi lại y hệt bị chặn; quá 3 bình luận / phút bị chặn
insert into public.comments (story_id, content)
values (pg_temp.story_id('truyen-chong-spam'), 'Hay quá');
select pg_temp.expect_error(
  $$insert into public.comments (story_id, content)
    values (pg_temp.story_id('truyen-chong-spam'), 'Hay quá')$$,
  'duplicate_comment');
insert into public.comments (story_id, content)
values (pg_temp.story_id('truyen-chong-spam'), 'Chờ chương mới'),
  (pg_temp.story_id('truyen-chong-spam'), 'Cảm ơn tác giả');
select pg_temp.expect_error(
  $$insert into public.comments (story_id, content)
    values (pg_temp.story_id('truyen-chong-spam'), 'Bình luận thứ tư')$$,
  'rate_limited');

-- Khách: mỗi IP 1 lượt / chương / ngày, IP khác thì tính thêm
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', true);
set local role anon;
select public.record_chapter_view('truyen-chong-spam', 1);
select public.record_chapter_view('truyen-chong-spam', 1);
select set_config('request.headers', '{"x-forwarded-for": "198.51.100.9"}', true);
select public.record_chapter_view('truyen-chong-spam', 1);
select pg_temp.expect(
  (select view_count = 3 from public.story_cards where slug = 'truyen-chong-spam'),
  'khách tính theo IP: cùng IP 1 lượt, IP khác thêm 1 lượt');

-- Liên hệ: tối đa 3 tin / giờ cho một email
insert into public.contact_messages (name, email, topic, message) values
  ('Khách', 'spam@example.com', 'general', 'Tin nhắn thứ nhất.'),
  ('Khách', 'spam@example.com', 'general', 'Tin nhắn thứ hai.'),
  ('Khách', 'SPAM@example.com', 'general', 'Tin nhắn thứ ba.');
select pg_temp.expect_error(
  $$insert into public.contact_messages (name, email, topic, message)
    values ('Khách', 'spam@example.com', 'general', 'Tin nhắn thứ tư.')$$,
  'rate_limited');
select pg_temp.expect_error($$select public.delete_account()$$, '42501');

-- ── Admin: hộp thư và báo lỗi toàn web ─────────────────────────────────

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);
set local role authenticated;
select public.report_chapter('truyen-chong-spam', 1, 'typo', 'Sai chính tả');
select pg_temp.expect_error($$select * from public.admin_reports()$$, 'forbidden');
select pg_temp.expect_error($$select * from public.admin_contact_messages()$$, 'forbidden');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select pg_temp.expect(
  (select count(*) = 1 from public.admin_reports('open')
    where story_slug = 'truyen-chong-spam' and chapter_title = 'Một'
      and reporter_name = 'khach-c'),
  'admin thấy báo lỗi của truyện người khác, kèm tên truyện, chương, người báo');
select public.admin_set_report_status(
  (select id from public.admin_reports('open') where story_slug = 'truyen-chong-spam'), 'resolved');
select pg_temp.expect(
  (select count(*) = 1 from public.admin_reports('resolved')
    where story_slug = 'truyen-chong-spam' and resolved_at is not null),
  'admin đánh dấu báo lỗi đã sửa');
select pg_temp.expect(
  (select count(*) = 1 from public.admin_reports(null, 'CHỐNG spam')
      where story_slug = 'truyen-chong-spam')
    and (select count(*) = 1 from public.admin_reports(null, 'sai chinh ta')
      where story_slug = 'truyen-chong-spam')
    and (select count(*) = 1 from public.admin_reports('resolved', 'khach-c')
      where story_slug = 'truyen-chong-spam')
    and not exists (select 1 from public.admin_reports('open', 'khach-c')
      where story_slug = 'truyen-chong-spam')
    and not exists (select 1 from public.admin_reports(null, 'khong co chu nay')
      where story_slug = 'truyen-chong-spam'),
  'admin_reports tìm không dấu theo tên truyện, ghi chú, người báo');
select pg_temp.expect(
  (select count(*) >= 3 from public.admin_contact_messages('open')),
  'admin đọc được tin nhắn liên hệ chưa xử lý');
select public.admin_set_contact_handled(
  (select id from public.admin_contact_messages('open') where message = 'Tin nhắn thứ nhất.'),
  true);
select pg_temp.expect(
  (select count(*) = 1 from public.admin_contact_messages('handled')
    where message = 'Tin nhắn thứ nhất.' and handled_at is not null)
    and (select (o -> 'totals' ->> 'unhandledMessages')::int >= 2
      from public.admin_overview(7) as o),
  'đánh dấu tin nhắn đã xử lý; tổng quan đếm tin chưa xử lý');
select pg_temp.expect(
  (select count(*) = 1 from public.admin_contact_messages(null, 'THỨ nhat')
      where lower(email) = 'spam@example.com')
    and (select count(*) = 3 from public.admin_contact_messages(null, 'spam@example')
      where lower(email) = 'spam@example.com')
    and (select count(*) = 2 from public.admin_contact_messages('open', 'spam@example')
      where lower(email) = 'spam@example.com')
    and not exists (select 1 from public.admin_contact_messages(null, 'khong co chu nay')
      where lower(email) = 'spam@example.com'),
  'admin_contact_messages tìm không dấu theo tên, email, nội dung');

-- ── Admin: gỡ truyện, khóa tài khoản ───────────────────────────────────

select public.admin_set_story_takedown(pg_temp.story_id('truyen-chong-spam'), 'Đạo văn');
select pg_temp.expect(
  (select visibility = 'draft' and takedown_reason = 'Đạo văn' and taken_down_at is not null
    from public.admin_stories() where slug = 'truyen-chong-spam'),
  'gỡ truyện: về nháp, ghi lý do');
select pg_temp.expect_error(
  $$select public.admin_set_user_banned('00000000-0000-4000-8000-00000000000c', true)$$,
  'cannot_ban_self');

reset role;
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-00000000000d', 'admin-d@kiem-tra.local', '{"role": "admin"}');
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select pg_temp.expect_error(
  $$select public.admin_set_user_banned('00000000-0000-4000-8000-00000000000d', true)$$,
  'cannot_ban_admin');
select public.admin_set_user_banned('00000000-0000-4000-8000-00000000000a', true);
select pg_temp.expect(
  (select is_banned from public.admin_users('tac gia a'))
    and (select (o -> 'totals' ->> 'bannedUsers')::int = 1 from public.admin_overview(7) as o),
  'khóa tài khoản: admin_users và tổng quan thấy trạng thái khóa');

-- Tác giả A không tự công khai lại truyện đang bị gỡ, nhưng thấy lý do trong khu Sáng tác
reset role;
select pg_temp.expect(
  (select banned_until = 'infinity' from auth.users
    where id = '00000000-0000-4000-8000-00000000000a'),
  'khóa tài khoản đặt banned_until');
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect(
  (select takedown_reason = 'Đạo văn' from public.studio_stories where slug = 'truyen-chong-spam'),
  'tác giả thấy lý do gỡ');
select pg_temp.expect_error(
  $$update public.stories set visibility = 'published' where slug = 'truyen-chong-spam'$$,
  'story_taken_down');
select pg_temp.expect_error(
  $$update public.stories set taken_down_at = null where slug = 'truyen-chong-spam'$$,
  '42501');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
-- Truyện đang là nháp nên admin (không phải chủ) lấy id qua admin_stories
select public.admin_set_story_takedown(
  (select id from public.admin_stories() where slug = 'truyen-chong-spam'), null);
select public.admin_set_user_banned('00000000-0000-4000-8000-00000000000a', false);
select pg_temp.expect(
  not (select is_banned from public.admin_users('tac gia a')),
  'mở khóa tài khoản');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
-- Gỡ làm mất dấu đã duyệt: khôi phục xong phải gửi duyệt lại
select pg_temp.expect_error(
  $$update public.stories set visibility = 'published' where slug = 'truyen-chong-spam'$$,
  'story_not_approved');
select public.submit_story_for_review(pg_temp.story_id('truyen-chong-spam'));
reset role;
select pg_temp.approve('truyen-chong-spam');
set local role authenticated;
select pg_temp.expect(
  (select visibility = 'published' from public.stories where slug = 'truyen-chong-spam'),
  'khôi phục, gửi duyệt lại và được duyệt thì công khai');

-- ── Duyệt truyện ────────────────────────────────────────────────────────

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
select * from public.create_story('Truyện Chờ Duyệt', 'Giới thiệu.', 'ongoing', array['co-dai'],
  null, '{"title": "Một", "content": "Nội dung."}', true);
select pg_temp.expect_error(
  $$select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), true, null)$$,
  'forbidden');

-- Người khác và khách không thấy truyện chờ duyệt
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect(
  not exists (select 1 from public.stories where slug = 'truyen-cho-duyet'),
  'người khác không thấy truyện chờ duyệt');
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select pg_temp.expect(
  not exists (select 1 from public.stories where slug = 'truyen-cho-duyet'),
  'khách không thấy truyện chờ duyệt');

-- Quản trị viên xem trước (truyện + chương đã xuất bản), từ chối cần lý do, rồi từ chối
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select pg_temp.expect(
  exists (select 1 from public.story_cards where slug = 'truyen-cho-duyet'),
  'quản trị viên thấy truyện chờ duyệt');
select pg_temp.expect(
  exists (select 1 from public.chapters where story_id = pg_temp.story_id('truyen-cho-duyet')
    and number = 1),
  'quản trị viên đọc được chương của truyện chờ duyệt');
select pg_temp.expect(
  (select count(*) = 1 from public.admin_stories() where review_status = 'pending'
    and id not in (select id from existing_stories)),
  'admin_stories có truyện chờ duyệt');
select pg_temp.expect(
  (public.admin_overview(7) -> 'totals' ->> 'pendingReviews')::integer >= 1,
  'admin_overview đếm truyện chờ duyệt');
select pg_temp.expect_error(
  $$select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), false, '  ')$$,
  'reason_required');
select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), false, 'Thiếu giới thiệu');
-- Bị từ chối thì quản trị viên không còn đọc thẳng được truyện: lấy id qua admin_stories
select pg_temp.expect(
  not exists (select 1 from public.stories where slug = 'truyen-cho-duyet'),
  'truyện bị từ chối không còn hiện cho quản trị viên ngoài admin_stories');
select pg_temp.expect_error(
  $$select public.admin_review_story(
    (select id from public.admin_stories() where slug = 'truyen-cho-duyet'), true, null)$$,
  'not_pending');

-- A gửi lại, quản trị viên duyệt: công khai; gỡ thì mất dấu đã duyệt
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect(
  (select review_status = 'rejected' and review_reason = 'Thiếu giới thiệu'
    from public.studio_stories where slug = 'truyen-cho-duyet'),
  'tác giả thấy lý do từ chối');
select public.submit_story_for_review(pg_temp.story_id('truyen-cho-duyet'));
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select public.admin_review_story(pg_temp.story_id('truyen-cho-duyet'), true, null);
select pg_temp.expect(
  (select visibility = 'published' and review_status = 'approved' and published_at is not null
    from public.stories where slug = 'truyen-cho-duyet'),
  'duyệt thì công khai luôn');
select public.admin_set_story_takedown(pg_temp.story_id('truyen-cho-duyet'), 'Đạo văn');
select public.admin_set_story_takedown(
  (select id from public.admin_stories() where slug = 'truyen-cho-duyet'), '');
select pg_temp.expect(
  (select review_status is null from public.admin_stories() where slug = 'truyen-cho-duyet'),
  'gỡ rồi khôi phục: phải gửi duyệt lại');

-- Trả lại tác giả A cho đoạn sau
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

-- ── Admin: quản lý thể loại ─────────────────────────────────────────────

select pg_temp.expect_error($$select public.admin_delete_genre('the-loai-3')$$, 'forbidden');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select pg_temp.expect(
  (select g ->> 'slug' = 'the-loai-nam'
    from public.admin_update_genre('the-loai-5', '  Thể Loại   Năm ', 'Mô tả mới') as g),
  'đổi tên thể loại: slug đổi theo, tên gọn khoảng trắng');
select pg_temp.expect_error(
  $$select public.admin_update_genre('the-loai-6', 'cổ đại', null)$$, 'genre_exists');
select pg_temp.expect(
  public.admin_merge_genres('co-dai', 'the-loai-nam') >= 1,
  'gộp thể loại trả về số truyện được chuyển');
select pg_temp.expect_error($$select public.admin_merge_genres('co-dai', 'the-loai-nam')$$, 'not_found');

reset role;
select pg_temp.expect(
  (select array_agg(genre_slug) = array['the-loai-nam'] from public.story_genres
    where story_id = pg_temp.story_id('truyen-chong-spam'))
    and not exists (select 1 from public.genres where slug = 'co-dai'),
  'gộp: truyện chuyển sang thể loại đích, thể loại nguồn bị xóa');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select public.admin_delete_genre('the-loai-nam');
reset role;
select pg_temp.expect(
  not exists (select 1 from public.story_genres
    where story_id = pg_temp.story_id('truyen-chong-spam')),
  'xóa thể loại: truyện mất thể loại đó');

-- ── Bút danh / tác giả gốc ──────────────────────────────────────────────

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
select * from public.create_story(
  'Chí Phèo', 'Truyện ngắn nổi tiếng về người nông dân bị tha hóa.', 'completed',
  array['the-loai-3'], null, '{"title": "Một", "content": "Hắn vừa đi vừa chửi."}', true,
  '  Nam   Cao ');
reset role;
select pg_temp.approve('chi-pheo');
set local role authenticated;
select pg_temp.expect(
  (select author_name = 'Nam Cao' and author_key = 'nam-cao'
    from public.story_cards where slug = 'chi-pheo'),
  'bút danh hiển thị thay tên tài khoản, gọn khoảng trắng');
select pg_temp.expect(
  (select author_name = 'Nam Cao' from public.studio_stories where slug = 'chi-pheo'),
  'khu Sáng tác thấy bút danh');
select pg_temp.expect(
  exists (select 1 from public.search_stories('nam cao') s
    where s.story_id = pg_temp.story_id('chi-pheo') and s.score = 1),
  'tìm được theo bút danh');
select * from public.update_story(
  pg_temp.story_id('chi-pheo'), 'Chí Phèo', 'Truyện ngắn nổi tiếng về người nông dân bị tha hóa.',
  'completed', array['the-loai-3'], null, '');
select pg_temp.expect(
  (select author_name = 'Tác giả A' and author_key is null
    from public.story_cards where slug = 'chi-pheo'),
  'xóa bút danh thì hiển thị lại tên tài khoản');
reset role;

-- ── Admin: truyện chọn tay cho trang chủ ────────────────────────────────

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect_error($$select * from public.admin_curated('featured')$$, 'forbidden');
select pg_temp.expect_error($$select public.admin_set_curated('featured', '{}')$$, 'forbidden');
select pg_temp.expect_error(
  $$insert into public.curated_stories (list, story_id)
    values ('featured', pg_temp.story_id('chi-pheo'))$$,
  '42501');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select public.admin_set_curated('featured', array[
  pg_temp.story_id('chi-pheo'), pg_temp.story_id('truyen-chong-spam'), pg_temp.story_id('chi-pheo')]);
select pg_temp.expect(
  (select array_agg(t.slug order by t.ord) = array['chi-pheo', 'truyen-chong-spam']
      and bool_and(t.is_public)
    from public.admin_curated('featured')
      with ordinality as t(story_id, slug, title, author_name, is_public, ord)),
  'chọn truyện nổi bật: giữ thứ tự, bỏ id lặp lại');
select pg_temp.expect(
  not exists (select 1 from public.admin_curated('editor_pick')),
  'danh sách đề cử không đổi khi sửa danh sách nổi bật');
select pg_temp.expect_error(
  $$select public.admin_set_curated('featured',
    (select array_agg(gen_random_uuid()) from generate_series(1, 9)))$$,
  'too_many_curated');
select pg_temp.expect_error(
  $$select public.admin_set_curated('editor_pick', array[gen_random_uuid()])$$, 'not_found');
select pg_temp.expect_error($$select public.admin_set_curated('khac', '{}')$$, 'not_found');
select public.admin_set_curated('featured', array[pg_temp.story_id('truyen-chong-spam')]);

reset role;
set local role anon;
select pg_temp.expect(
  (select array_agg(story_id) = array[pg_temp.story_id('truyen-chong-spam')]
    from public.curated_stories where list = 'featured'),
  'khách đọc được danh sách chọn tay, lưu lại thì thay cả danh sách');

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select public.admin_set_curated('featured', '{}');
reset role;
select pg_temp.expect(
  not exists (select 1 from public.curated_stories where list = 'featured'),
  'bỏ hết truyện chọn tay');

-- ── Trả lời và báo cáo bình luận ────────────────────────────────────────

create function pg_temp.spam_comment(p_content text)
returns uuid
language sql
as $$
  select id from public.comments
  where story_id = pg_temp.story_id('truyen-chong-spam') and content = p_content
$$;

-- A trả lời bình luận "Hay quá" của C
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;
insert into public.comments (story_id, content, parent_id) values
  (pg_temp.story_id('truyen-chong-spam'), 'Cảm ơn bạn', pg_temp.spam_comment('Hay quá')),
  (pg_temp.story_id('truyen-chong-spam'), 'Chúc bạn đọc vui', pg_temp.spam_comment('Hay quá'));
select pg_temp.expect_error(
  $$insert into public.comments (story_id, content, parent_id)
    values (pg_temp.story_id('truyen-chong-spam'), 'Lồng hai cấp', pg_temp.spam_comment('Cảm ơn bạn'))$$,
  'invalid_parent');
select pg_temp.expect_error(
  $$insert into public.comments (story_id, chapter_number, content, parent_id)
    values (pg_temp.story_id('truyen-chong-spam'), 1, 'Sai chỗ', pg_temp.spam_comment('Hay quá'))$$,
  'invalid_parent');
select pg_temp.expect_error(
  $$insert into public.comments (story_id, content, parent_id)
    values (pg_temp.story_id('truyen-chong-spam'), 'Không có gốc', gen_random_uuid())$$,
  'parent_not_found');

-- Báo cáo: không báo bình luận của mình, bình luận không có; báo lại thì cập nhật
select pg_temp.expect_error(
  $$select public.report_comment(pg_temp.spam_comment('Cảm ơn bạn'), 'spam')$$, 'own_comment');
select pg_temp.expect_error(
  $$select public.report_comment(gen_random_uuid(), 'spam')$$, 'not_found');
select pg_temp.expect_error(
  $$select public.report_comment(pg_temp.spam_comment('Chờ chương mới'), 'other', '  ')$$, '23514');
select public.report_comment(pg_temp.spam_comment('Chờ chương mới'), 'offensive');
select public.report_comment(pg_temp.spam_comment('Chờ chương mới'), 'spam', ' Quảng cáo ');
select pg_temp.expect_error($$select * from private.comment_reports$$, '42501');
select pg_temp.expect_error($$select * from public.admin_comments()$$, 'forbidden');
select pg_temp.expect_error(
  $$select public.admin_delete_comment(gen_random_uuid())$$, 'forbidden');
select pg_temp.expect_error(
  $$select public.admin_dismiss_comment_reports(gen_random_uuid())$$, 'forbidden');

-- Tối đa 10 báo cáo mới / giờ: A đã có 1, thêm 9 báo cáo cũ đã xử lý
reset role;
insert into private.comment_reports (comment_id, reporter_id, reason, status, resolved_at)
select pg_temp.spam_comment('Chờ chương mới'), '00000000-0000-4000-8000-00000000000a', 'spam',
  'resolved', now()
from generate_series(1, 9);
set local role authenticated;
select pg_temp.expect_error(
  $$select public.report_comment(pg_temp.spam_comment('Cảm ơn tác giả'), 'spam')$$,
  'rate_limited');
select public.report_comment(pg_temp.spam_comment('Chờ chương mới'), 'spam', 'Quảng cáo web khác');

-- Khách đọc được bình luận gốc kèm số trả lời, không báo cáo được
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select pg_temp.expect(
  (select count(*) = 3 and sum(t.reply_count) = 2 and bool_and(t.display_name is not null)
    from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t),
  'comment_threads: chỉ bình luận gốc, kèm người viết và số trả lời');
select pg_temp.expect(
  (select t.reply_count = 2
    from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t
    where t.content = 'Hay quá'),
  'comment_threads đếm trả lời của từng bình luận');
select pg_temp.expect(
  not exists (select 1 from public.comment_threads(pg_temp.story_id('truyen-chong-spam'), 1)),
  'comment_threads theo chương không lẫn bình luận của truyện');
select pg_temp.expect_error(
  $$select public.report_comment(gen_random_uuid(), 'spam')$$, '42501');

-- Admin: xem, bỏ qua báo cáo, xóa bình luận
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select pg_temp.expect(
  (select count(*) = 5 from public.admin_comments() where story_slug = 'truyen-chong-spam')
    and (select count(*) = 2 from public.admin_comments('TÁC GIẢ A')
      where story_slug = 'truyen-chong-spam' and is_reply)
    and (select count(*) = 1 from public.admin_comments('cam on ban')
      where story_slug = 'truyen-chong-spam'),
  'admin_comments: mọi bình luận, tìm không dấu theo nội dung và người viết');
select pg_temp.expect(
  (select count(*) = 1
      and bool_and(c.content = 'Chờ chương mới'
        and jsonb_array_length(c.reports) = 1
        and c.reports -> 0 ->> 'reason' = 'spam'
        and c.reports -> 0 ->> 'note' = 'Quảng cáo web khác'
        and c.reports -> 0 ->> 'reporterName' = 'Tác giả A')
    from public.admin_comments(null, true) c where c.story_slug = 'truyen-chong-spam'),
  'admin_comments(reported): báo lại chỉ cập nhật báo cáo đang mở');
select pg_temp.expect(
  (select (o -> 'totals' ->> 'reportedComments')::int >= 1 from public.admin_overview(7) as o),
  'tổng quan đếm bình luận đang bị báo cáo');
select public.admin_dismiss_comment_reports(pg_temp.spam_comment('Chờ chương mới'));
select pg_temp.expect(
  not exists (select 1 from public.admin_comments(null, true)
    where story_slug = 'truyen-chong-spam'),
  'bỏ qua báo cáo thì bình luận rời danh sách bị báo cáo');
select pg_temp.expect(
  (select reply_count = 2 from public.admin_comments()
    where id = pg_temp.spam_comment('Hay quá')),
  'admin_comments có số trả lời');
select public.admin_delete_comment(pg_temp.spam_comment('Hay quá'));
select pg_temp.expect(
  (select count(*) = 2 from public.admin_comments() where story_slug = 'truyen-chong-spam'),
  'admin xóa bình luận gốc thì trả lời mất theo');
select pg_temp.expect_error(
  $$select public.admin_delete_comment(gen_random_uuid())$$, 'not_found');
select public.admin_delete_comment(pg_temp.spam_comment('Chờ chương mới'));
reset role;
select pg_temp.expect(
  not exists (select 1 from private.comment_reports
    where reporter_id = '00000000-0000-4000-8000-00000000000a'),
  'xóa bình luận thì báo cáo của nó mất theo');

-- ── Tự xóa tài khoản ────────────────────────────────────────────────────

reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);
set local role authenticated;
select public.delete_account();

reset role;
select pg_temp.expect(
  not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-00000000000c')
    and not exists (select 1 from public.profiles
      where id = '00000000-0000-4000-8000-00000000000c')
    and not exists (select 1 from public.comments
      where user_id = '00000000-0000-4000-8000-00000000000c'),
  'delete_account xóa tài khoản, hồ sơ và bình luận của chính người gọi');
select pg_temp.expect(
  exists (select 1 from auth.users where id = '00000000-0000-4000-8000-00000000000a'),
  'delete_account không đụng tới tài khoản khác');

-- ── Chống lạm dụng: hạn mức tác giả, ảnh, báo lỗi, ảnh đại diện ──────────

reset role;
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-4000-8000-000000000011', 'd11@kiem-tra.local', '{"display_name": "D"}',
    '{"provider": "email"}'),
  ('00000000-0000-4000-8000-000000000012', 'e12@kiem-tra.local',
    '{"display_name": "E", "avatar_url": "https://evil.example/track.gif"}',
    '{"provider": "email"}'),
  ('00000000-0000-4000-8000-000000000013', 'f13@kiem-tra.local',
    '{"full_name": "F", "picture": "https://lh3.googleusercontent.com/a/f"}',
    '{"provider": "google"}');
select pg_temp.expect(
  (select avatar_url is null from public.profiles
    where id = '00000000-0000-4000-8000-000000000012'),
  'đăng ký email không gắn được ảnh ngoài qua options.data');
select pg_temp.expect(
  (select avatar_url = 'https://lh3.googleusercontent.com/a/f' from public.profiles
    where id = '00000000-0000-4000-8000-000000000013'),
  'đăng nhập Google vẫn lấy ảnh của Google');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000011", "role": "authenticated"}', true);
set local role authenticated;

-- Tối đa 10 truyện mới / ngày
select public.create_story('Han muc ' || i, 'x', 'ongoing', '{}') from generate_series(1, 10) i;
select pg_temp.expect_error(
  $$select public.create_story('Han muc 11', 'x', 'ongoing', '{}')$$, 'story_limit');

-- Tối đa 10.000.000 byte nội dung chương ghi vào / ngày, tính cả khi sửa
insert into public.chapters (story_id, number, content)
select pg_temp.story_id('han-muc-1'), i, repeat('a', 200000) from generate_series(1, 49) i;
update public.chapters set content = repeat('b', 200000)
where story_id = pg_temp.story_id('han-muc-1') and number = 1;
select pg_temp.expect_error(
  $$update public.chapters set content = repeat('c', 200000)
    where story_id = pg_temp.story_id('han-muc-1') and number = 2$$,
  'chapter_limit');
select pg_temp.expect_error(
  $$insert into public.chapters (story_id, number, content)
    values (pg_temp.story_id('han-muc-1'), 99, 'x')$$,
  'chapter_limit');

-- Ảnh: tối đa 30 ảnh mới / 24 giờ
insert into storage.objects (bucket_id, name, owner_id)
select 'covers', '00000000-0000-4000-8000-000000000011/' || i || '.webp',
  '00000000-0000-4000-8000-000000000011'
from generate_series(1, 30) i;
select pg_temp.expect_error(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-4000-8000-000000000011/31.webp',
      '00000000-0000-4000-8000-000000000011')$$,
  '42501');

-- Quản trị viên (nhập truyện hàng loạt) không bị giới hạn
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000011", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
set local role authenticated;
select public.create_story('Han muc admin', 'x', 'ongoing', '{}',
  null, '{"title": "C1", "content": "Noi dung."}');
insert into storage.objects (bucket_id, name, owner_id)
values ('covers', '00000000-0000-4000-8000-000000000011/admin.webp',
  '00000000-0000-4000-8000-000000000011');

-- Ảnh đại diện chỉ nhận ảnh trong thư mục của chính mình trên bucket avatars
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000013", "role": "authenticated"}', true);
update public.profiles set display_name = 'F đổi tên'
where id = '00000000-0000-4000-8000-000000000013';
select pg_temp.expect_error(
  $$update public.profiles set avatar_url = 'https://evil.example/track.gif'
    where id = '00000000-0000-4000-8000-000000000013'$$,
  'invalid_avatar_url');
select pg_temp.expect_error(
  $$update public.profiles set avatar_url = 'https://zsbyjxaaxtylgmxybzpf.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-8000-000000000011/x.webp'
    where id = '00000000-0000-4000-8000-000000000013'$$,
  'invalid_avatar_url');
update public.profiles
set avatar_url = 'https://zsbyjxaaxtylgmxybzpf.supabase.co/storage/v1/object/public/avatars/00000000-0000-4000-8000-000000000013/a.webp'
where id = '00000000-0000-4000-8000-000000000013';
update public.profiles set avatar_url = null where id = '00000000-0000-4000-8000-000000000013';

-- Người gửi báo lỗi không tự lùi created_at được (né giới hạn 10 / giờ)
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
select pg_temp.expect_error(
  $$update public.chapter_reports set created_at = '2000-01-01'$$, '42501');
reset role;

-- ── Chặn người dùng ─────────────────────────────────────────────────────

-- G chặn H: không còn thấy bình luận, trả lời của H; người khác vẫn thấy
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000021', 'g@kiem-tra.local', '{"display_name": "G chặn"}'),
  ('00000000-0000-4000-8000-000000000022', 'h@kiem-tra.local', '{"display_name": "H bị chặn"}');

create function pg_temp.block_comment(p_content text)
returns uuid
language sql
as $$
  select id from public.comments
  where story_id = pg_temp.story_id('truyen-chong-spam') and content = p_content
$$;

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000022", "role": "authenticated"}', true);
set local role authenticated;
insert into public.comments (story_id, content)
  values (pg_temp.story_id('truyen-chong-spam'), 'Bình luận của H');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000021", "role": "authenticated"}', true);
insert into public.comments (story_id, content)
  values (pg_temp.story_id('truyen-chong-spam'), 'Bình luận của G');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000022", "role": "authenticated"}', true);
insert into public.comments (story_id, content, parent_id)
  values (pg_temp.story_id('truyen-chong-spam'), 'H trả lời G', pg_temp.block_comment('Bình luận của G'));

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000021", "role": "authenticated"}', true);
select pg_temp.expect(
  exists (select 1 from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t
    where t.user_id = '00000000-0000-4000-8000-000000000022'),
  'chưa chặn: thấy bình luận của H');
insert into public.user_blocks (blocked_id) values ('00000000-0000-4000-8000-000000000022');
select pg_temp.expect(
  not exists (select 1 from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t
    where t.user_id = '00000000-0000-4000-8000-000000000022'),
  'chặn rồi: comment_threads bỏ bình luận gốc của H');
select pg_temp.expect(
  (select t.reply_count = 0 from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t
    where t.content = 'Bình luận của G'),
  'chặn rồi: số trả lời không đếm trả lời của H');
select pg_temp.expect(
  not exists (select 1 from public.comments
    where user_id = '00000000-0000-4000-8000-000000000022'),
  'chặn rồi: đọc thẳng bảng comments cũng không thấy H');
select pg_temp.expect(
  (select count(*) = 1 from public.user_blocks),
  'G thấy dòng chặn của mình');
select pg_temp.expect_error(
  $$insert into public.user_blocks (blocked_id) values ('00000000-0000-4000-8000-000000000022')$$,
  '23505');
select pg_temp.expect_error(
  $$insert into public.user_blocks (blocked_id) values ('00000000-0000-4000-8000-000000000021')$$,
  '23514');
-- Không ghi được blocker_id (chặn thay người khác)
select pg_temp.expect_error(
  $$insert into public.user_blocks (blocker_id, blocked_id)
    values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000022')$$,
  '42501');

-- H vẫn thấy bình luận của mình, không thấy và không xóa được dòng chặn của G
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000022", "role": "authenticated"}', true);
select pg_temp.expect(
  exists (select 1 from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t
    where t.content = 'Bình luận của H'),
  'người bị chặn vẫn thấy bình luận của mình');
select pg_temp.expect(not exists (select 1 from public.user_blocks), 'H không thấy dòng chặn của G');
select pg_temp.expect(pg_temp.affected($$delete from public.user_blocks$$) = 0,
  'H không xóa được dòng chặn của G');

-- Khách vẫn thấy bình luận của H, không đọc được bảng user_blocks
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select pg_temp.expect(
  exists (select 1 from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t
    where t.content = 'Bình luận của H'),
  'khách vẫn thấy bình luận của H');
select pg_temp.expect_error($$select * from public.user_blocks$$, '42501');

-- G bỏ chặn: thấy lại bình luận của H
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000021", "role": "authenticated"}', true);
set local role authenticated;
select pg_temp.expect(pg_temp.affected($$delete from public.user_blocks$$) = 1, 'G bỏ chặn H');
select pg_temp.expect(
  exists (select 1 from public.comment_threads(pg_temp.story_id('truyen-chong-spam')) t
    where t.content = 'Bình luận của H'),
  'bỏ chặn rồi: thấy lại bình luận của H');
reset role;

-- ── Thông báo đẩy chương mới ────────────────────────────────────────────

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000031', 'p@kiem-tra.local', '{"display_name": "P tác giả"}'),
  ('00000000-0000-4000-8000-000000000032', 'q@kiem-tra.local', '{"display_name": "Q đọc"}'),
  ('00000000-0000-4000-8000-000000000033', 'r@kiem-tra.local', '{"display_name": "R đọc"}');

-- Q đăng ký mã của máy; không tự ghi thẳng vào bảng được
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000032", "role": "authenticated"}', true);
set local role authenticated;
select public.register_push_token('ExponentPushToken[q-may-1]', 'ios');
select pg_temp.expect((select count(*) = 1 from public.push_tokens), 'Q thấy mã của mình');
select pg_temp.expect_error(
  $$select public.register_push_token('ExponentPushToken[q-web]', 'web')$$, '23514');
select pg_temp.expect_error(
  $$insert into public.push_tokens (token, user_id, platform)
    values ('ExponentPushToken[tu-ghi]', '00000000-0000-4000-8000-000000000032', 'ios')$$,
  '42501');

-- R đăng nhập trên máy của Q: mã chuyển sang R
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000033", "role": "authenticated"}', true);
select public.register_push_token('ExponentPushToken[q-may-1]', 'ios');
select pg_temp.expect(
  (select count(*) = 1 from public.push_tokens where token = 'ExponentPushToken[q-may-1]'),
  'mã chuyển sang R');
select pg_temp.expect(pg_temp.affected($$delete from public.push_tokens$$) = 1,
  'R xóa được mã của mình (đăng xuất)');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000032", "role": "authenticated"}', true);
select pg_temp.expect(not exists (select 1 from public.push_tokens), 'Q không còn mã của máy cũ');
select public.register_push_token('ExponentPushToken[q-may-2]', 'android');

-- Khách không đăng ký được
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select pg_temp.expect_error(
  $$select public.register_push_token('ExponentPushToken[khach]', 'ios')$$, '42501');

-- P đăng truyện (đã duyệt), Q theo dõi; P cũng có mã và tự theo dõi truyện mình
reset role;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000031", "role": "authenticated"}', true);
set local role authenticated;
insert into public.genres (name) values ('Thông Báo Đẩy');
select * from public.create_story(
  'Truyện Thông Báo', 'Truyện để kiểm tra thông báo chương mới.', 'ongoing', array['thong-bao-day'],
  null, '{"title": "Một", "content": "Nội dung chương một."}', true);
select public.register_push_token('ExponentPushToken[p-tac-gia]', 'ios');
insert into public.follows (story_id) values (pg_temp.story_id('truyen-thong-bao'));
reset role;
select pg_temp.approve('truyen-thong-bao');
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000032", "role": "authenticated"}', true);
set local role authenticated;
insert into public.follows (story_id) values (pg_temp.story_id('truyen-thong-bao'));

reset role;
create temp table push_before as select coalesce(max(id), 0) as id from net.http_request_queue;
create function pg_temp.push_bodies()
returns setof text
language sql
as $$
  select convert_from(q.body, 'UTF8') from net.http_request_queue q
  where q.id > (select id from push_before) and q.url = 'https://exp.host/--/api/v2/push/send'
$$;

-- P xuất bản chương 2: một thông báo tới máy của Q, không tới tác giả
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000031", "role": "authenticated"}', true);
set local role authenticated;
insert into public.chapters (story_id, number, title, content, status)
values (pg_temp.story_id('truyen-thong-bao'), 2, 'Hai', 'Nội dung chương hai.', 'published');
reset role;
select pg_temp.expect((select count(*) = 1 from pg_temp.push_bodies()), 'gửi một lần cho chương mới');
select pg_temp.expect(
  (select b like '%ExponentPushToken[q-may-2]%' and b not like '%p-tac-gia%'
      and b like '%/story/truyen-thong-bao/chapter-2%' and b like '%Chương 2: Hai%'
    from pg_temp.push_bodies() b),
  'thông báo tới người theo dõi (không tới tác giả), mở đúng chương');

-- Trong 30 phút: chương 3 không gửi thêm; chương nháp rồi xuất bản sau cũng vậy
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000031", "role": "authenticated"}', true);
set local role authenticated;
insert into public.chapters (story_id, number, title, content, status)
values (pg_temp.story_id('truyen-thong-bao'), 3, 'Ba', 'Nội dung chương ba.', 'published');
reset role;
select pg_temp.expect((select count(*) = 1 from pg_temp.push_bodies()),
  'trong 30 phút không gửi lại cho cùng truyện');

-- Hết 30 phút: chương nháp được xuất bản thì gửi; sửa chương đã xuất bản thì không gửi
update private.story_push_log set sent_at = now() - interval '1 hour'
where story_id = pg_temp.story_id('truyen-thong-bao');
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000031", "role": "authenticated"}', true);
set local role authenticated;
insert into public.chapters (story_id, number, title, content, status)
values (pg_temp.story_id('truyen-thong-bao'), 4, 'Bốn', 'Nội dung chương bốn.', 'draft');
update public.chapters set title = 'Hai (sửa)'
where story_id = pg_temp.story_id('truyen-thong-bao') and number = 2;
reset role;
select pg_temp.expect((select count(*) = 1 from pg_temp.push_bodies()),
  'chương nháp và sửa chương đã xuất bản không gửi');
set local role authenticated;
update public.chapters set status = 'published'
where story_id = pg_temp.story_id('truyen-thong-bao') and number = 4;
reset role;
select pg_temp.expect((select count(*) = 2 from pg_temp.push_bodies()),
  'chương nháp được xuất bản lần đầu thì gửi');
reset role;

-- ── Tổng quan quản trị: kỳ trước, bình luận/theo dõi, lịch nhiệt, thể loại, tác giả ──
-- DB thật có dữ liệu: chụp số liệu trước, thêm dữ liệu mẫu rồi so phần chênh lệch

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000041', 'tq1@kiem-tra.local', '{"display_name": "Chủ Bảng Tin"}'),
  ('00000000-0000-4000-8000-000000000042', 'tq2@kiem-tra.local', '{"display_name": "Bạn Đọc Bảng Tin"}');

-- Như quản trị viên: gọi thẳng hàm private (chủ phiên) để lưu số liệu vào bảng tạm
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
create temp table overview_before as select private.admin_overview(7) as o;

-- Chủ truyện đăng hai truyện với hai bút danh, cùng hai thể loại mới
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000041", "role": "authenticated"}', true);
set local role authenticated;
insert into public.genres (name) values ('Bảng Tin Một'), ('Bảng Tin Hai');
select * from public.create_story(
  'Truyện Bảng Tin', 'Truyện để kiểm tra trang tổng quan quản trị.', 'ongoing',
  array['bang-tin-mot', 'bang-tin-hai'], null, '{"title": "Một", "content": "Nội dung chương một."}',
  true, 'Bút Danh Một');
select * from public.create_story(
  'Truyện Bảng Tin Hai', 'Truyện thứ hai để kiểm tra tác giả nổi bật.', 'ongoing',
  array['bang-tin-mot'], null, '{"title": "Một", "content": "Nội dung chương một."}',
  true, 'Bút Danh Hai');
reset role;
select pg_temp.approve('truyen-bang-tin');
select pg_temp.approve('truyen-bang-tin-hai');

-- Bạn đọc theo dõi và bình luận hôm nay
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000042", "role": "authenticated"}', true);
set local role authenticated;
insert into public.follows (story_id) values (pg_temp.story_id('truyen-bang-tin'));
insert into public.comments (story_id, content)
values (pg_temp.story_id('truyen-bang-tin'), 'Bình luận để kiểm tra trang tổng quan.');

-- Lượt đọc lớn để chắc chắn vào top 10: hôm nay và đúng 7 ngày trước (kỳ trước của kỳ 7 ngày)
reset role;
insert into public.chapter_views (story_id, chapter_number, day, views) values
  (pg_temp.story_id('truyen-bang-tin'), 1, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 900000000),
  (pg_temp.story_id('truyen-bang-tin'), 1, (now() at time zone 'Asia/Ho_Chi_Minh')::date - 7, 300000000),
  (pg_temp.story_id('truyen-bang-tin-hai'), 1, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 800000000);
update public.story_stats set view_count = 2000000000
where story_id = pg_temp.story_id('truyen-bang-tin');

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated",
    "app_metadata": {"role": "admin"}}', true);
create temp table overview_after as select private.admin_overview(7) as o;

create function pg_temp.diff(p_path text[])
returns numeric
language sql
as $$
  select (a.o #>> p_path)::numeric - (b.o #>> p_path)::numeric
  from overview_after a, overview_before b
$$;

select pg_temp.expect(
  (select (o -> 'days' -> 0) ?& array['comments', 'follows', 'viewsPrev']
      and jsonb_array_length(o -> 'days') = 7
    from overview_after),
  'admin_overview: mỗi ngày có bình luận, theo dõi, lượt đọc kỳ trước');
select pg_temp.expect(
  pg_temp.diff(array['days', '6', 'views']) = 1700000000
    and pg_temp.diff(array['days', '6', 'viewsPrev']) = 300000000,
  'admin_overview: lượt đọc hôm nay và ngày tương ứng của kỳ trước');
select pg_temp.expect(
  pg_temp.diff(array['current', 'views']) = 1700000000
    and pg_temp.diff(array['previous', 'views']) = 300000000
    and pg_temp.diff(array['totals', 'viewsInPeriod']) = 1700000000,
  'admin_overview: tổng kỳ này, kỳ trước; viewsInPeriod không cộng lẫn kỳ trước');
select pg_temp.expect(
  pg_temp.diff(array['current', 'follows']) = 1
    and pg_temp.diff(array['current', 'comments']) = 1
    and pg_temp.diff(array['days', '6', 'follows']) = 1
    and pg_temp.diff(array['days', '6', 'comments']) = 1,
  'admin_overview: theo dõi và bình luận mới hôm nay');
select pg_temp.expect(
  (select extract(isodow from (o -> 'calendar' -> 0 ->> 'day')::date) = 1
      and (o -> 'calendar' -> -1 ->> 'day')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
      and jsonb_array_length(o -> 'calendar') between 78 and 84
    from overview_after),
  'admin_overview: lịch nhiệt bắt đầu thứ Hai, kết thúc hôm nay, 12 tuần');
select pg_temp.expect(
  (select o -> 'genreViews' @> '[{"name": "Bảng Tin Một", "views": 1700000000},
      {"name": "Bảng Tin Hai", "views": 900000000}]'
    from overview_after),
  'admin_overview: lượt đọc theo thể loại, truyện nhiều thể loại tính vào từng thể loại');
select pg_temp.expect(
  (select o -> 'topAuthors' @> '[{"name": "Bút Danh Một", "stories": 1, "views": 900000000, "followers": 1,
        "ownerId": "00000000-0000-4000-8000-000000000041"},
      {"name": "Bút Danh Hai", "stories": 1, "views": 800000000, "followers": 0}]'
    from overview_after),
  'admin_overview: một chủ truyện hai bút danh là hai tác giả');
select pg_temp.expect(
  (select o -> 'topStories' -> 0 ->> 'authorName' = 'Bút Danh Một' from overview_after),
  'admin_overview: top truyện hiện bút danh');
reset role;

select 'Tất cả kiểm tra đều qua' as ket_qua;

rollback;
