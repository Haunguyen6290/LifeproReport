-- 0010_avatars_storage_policies.sql
-- Bucket avatars đã tạo public; thêm RLS cho storage.objects để authenticated upload/sửa/xóa avatar

-- Cho phép mọi người đọc avatar (bucket public)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars public read') then
    create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars authenticated insert') then
    create policy "avatars authenticated insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars authenticated update') then
    create policy "avatars authenticated update" on storage.objects for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars authenticated delete') then
    create policy "avatars authenticated delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars');
  end if;
end $$;
