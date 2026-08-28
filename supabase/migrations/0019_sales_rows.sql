-- 0019_sales_rows.sql
-- Dashboard sổ bán hàng (Odoo): lưu mỗi dòng Excel làm 1 row, ghi đè theo sale_month.

create table if not exists public.sales_rows (
  id uuid primary key default gen_random_uuid(),
  so_ct text not null,
  ngay date not null,
  sale_month text not null,
  ma_vt text not null default '',
  ten_vt text not null default '',
  ma_kh text not null default '',
  ten_kh text not null default '',
  kinh_doanh_raw text not null default '',
  kinh_doanh text not null default '',
  so_luong numeric,
  don_gia numeric,
  thanh_tien numeric not null default 0,
  vung text not null default '',
  hang_sx text not null default '',
  nhom_hang text not null default '',
  ma_nv text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_month on public.sales_rows (sale_month);
create index if not exists idx_sales_kd on public.sales_rows (kinh_doanh);
create index if not exists idx_sales_vung on public.sales_rows (vung);
create index if not exists idx_sales_nhom on public.sales_rows (nhom_hang);
create index if not exists idx_sales_ngay on public.sales_rows (ngay);
create index if not exists idx_sales_kh on public.sales_rows (ma_kh);

alter table public.sales_rows enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales_rows' and policyname='sales_read') then
    create policy sales_read on public.sales_rows for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales_rows' and policyname='sales_write') then
    create policy sales_write on public.sales_rows for all to authenticated
      using (public.has_permission('quan_ly_cai_dat')) with check (public.has_permission('quan_ly_cai_dat'));
  end if;
end $$;

insert into public.settings (key, value) values
  ('SALES_ALLOWED_NAMES', '["Mai Đình Chiến","Đinh Anh Chi","Nguyễn Xuân Vũ","Nguyễn Trung Chính SG","Đỗ Thành Công"]'),
  ('SALES_NAME_MAP', '{"Nguyễn Trung Chính SG":"Nguyễn Trung Chính","Đỗ Thành Công":"Nguyễn Trung Chính"}')
on conflict (key) do nothing;
