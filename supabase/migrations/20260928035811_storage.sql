-- Ảnh bìa truyện và ảnh đại diện. Bucket công khai (đọc qua public URL, không cần policy select để
-- xem ảnh); ghi chỉ trong thư mục của chính mình: {user_id}/{uuid}.webp.
-- Giới hạn khớp src/lib/image.ts (bìa 480×720, avatar 128×128, xuất WebP hoặc JPEG).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers', 'covers', true, 2097152, array['image/webp', 'image/jpeg']),
  ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upsert cần đủ insert + select + update
create policy images_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id in ('covers', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('covers', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy images_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id in ('covers', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('covers', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('covers', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
