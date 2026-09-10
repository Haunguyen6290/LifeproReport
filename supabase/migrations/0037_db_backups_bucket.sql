-- Bucket backup rieng tu (chi service_role ghi/doc, khong phoi ra public)
insert into storage.buckets (id, name, public)
values ('db-backups','db-backups', false)
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='db-backups service read') then
    create policy "db-backups service read" on storage.objects
      for select to service_role using (bucket_id='db-backups');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='db-backups service write') then
    create policy "db-backups service write" on storage.objects
      for all to service_role using (bucket_id='db-backups') with check (bucket_id='db-backups');
  end if;
end $$;
