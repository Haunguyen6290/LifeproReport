-- 0054: customer_interactions — lịch sử chăm sóc / tương tác từng khách hàng.
-- Tab "Tương tác" trong chi tiết khách (CRM). Gọn: ngày + loại + nội dung + hẹn nhắc lại.

create table if not exists public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  loai text not null default 'goi' check (loai in ('goi','gap','zalo','khieu_nai')),
  noi_dung text not null default '',
  ngay date not null default CURRENT_DATE,
  hen_nhac date,
  nguoi_tao uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_cust_inter_cust_ngay
  on public.customer_interactions(customer_id, ngay desc);

alter table public.customer_interactions enable row level security;

drop policy if exists ci_read on public.customer_interactions;
create policy ci_read on public.customer_interactions
  for select to authenticated using (true);

drop policy if exists ci_insert on public.customer_interactions;
create policy ci_insert on public.customer_interactions
  for insert to authenticated with check (true);

drop policy if exists ci_update on public.customer_interactions;
create policy ci_update on public.customer_interactions
  for update to authenticated using (true);

drop policy if exists ci_delete on public.customer_interactions;
create policy ci_delete on public.customer_interactions
  for delete to authenticated using (true);
