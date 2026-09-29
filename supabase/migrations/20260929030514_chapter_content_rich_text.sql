-- Nội dung chương có định dạng: trình soạn lưu HTML rút gọn (<p>, <h2>, <strong>...), chương cũ vẫn
-- là văn bản thuần. Giới hạn 100.000 ký tự chữ nhìn thấy do client kiểm tra; bản lưu có thêm thẻ
-- định dạng nên nới lên 200.000 (khớp CONTENT_STORED_MAX ở features/studio/schemas.ts).
alter table public.chapters drop constraint chapters_content_check;
alter table public.chapters
  add constraint chapters_content_check check (char_length(content) between 1 and 200000);
