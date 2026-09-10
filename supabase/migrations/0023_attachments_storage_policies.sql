-- 0023_attachments_storage_policies.sql
-- Bucket attachments đã tạo public; thêm RLS cho storage.objects để authenticated upload/sửa/xóa ảnh bảng tin

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='attachments public read') then
    create policy "attachments public read" on storage.objects for select using (bucket_id = 'attachments');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='attachments authenticated insert') then
    create policy "attachments authenticated insert" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='attachments authenticated update') then
    create policy "attachments authenticated update" on storage.objects for update to authenticated using (bucket_id = 'attachments') with check (bucket_id = 'attachments');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='attachments authenticated delete') then
    create policy "attachments authenticated delete" on storage.objects for delete to authenticated using (bucket_id = 'attachments');
  end if;
end $$;
