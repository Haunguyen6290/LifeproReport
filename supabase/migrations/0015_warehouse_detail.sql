-- 0015_warehouse_detail.sql
-- Báo cáo kho: cho phép comment trên từng phiếu (như Chiến dịch) + bảng cập nhật như Chiến dịch
-- Depends on 0001_init.sql (comments, attachments, object_links checks)

alter table public.comments drop constraint if exists comments_target_type_check;
alter table public.comments add constraint comments_target_type_check check (target_type in ('news','campaign_update','warehouse_report'));

alter table public.attachments drop constraint if exists attachments_owner_type_check;
alter table public.attachments add constraint attachments_owner_type_check check (owner_type in ('news','campaign_update','comment','warehouse_report'));

-- Bảng cập nhật cho kho (như campaign_updates nhưng gắn warehouse_reports)
create table if not exists public.warehouse_report_updates (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.warehouse_reports(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.warehouse_report_updates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='warehouse_report_updates' and policyname='wrup_read') then
    create policy wrup_read on public.warehouse_report_updates for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='warehouse_report_updates' and policyname='wrup_ins') then
    create policy wrup_ins on public.warehouse_report_updates for insert to authenticated with check (reporter_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='warehouse_report_updates' and policyname='wrup_upd') then
    create policy wrup_upd on public.warehouse_report_updates for update to authenticated using (reporter_id = auth.uid() or public.has_permission('quan_ly_okr'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='warehouse_report_updates' and policyname='wrup_del') then
    create policy wrup_del on public.warehouse_report_updates for delete to authenticated using (reporter_id = auth.uid() or public.has_permission('quan_ly_okr'));
  end if;
end $$;

create index if not exists idx_wrup_report on public.warehouse_report_updates (report_id, created_at desc);
