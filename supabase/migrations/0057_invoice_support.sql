-- 0057: Ho tro xuat hoa don — DM thue/thuc + ton theo ngay + hoa don goi y + tru tam
-- Cap1 chinh, Cap2 gom bong/bi gam; ton thue/thuc theo ngay import; hoa don tru tam trong ngay

-- DM thue: ma thue chuan, gia chua VAT, VAT%, Cap1/Cap2
create table if not exists public.dm_thue (
  ma_thue text primary key,
  ten_thue text not null default '',
  cap1 text not null default '',
  cap2 text not null default '',
  gia_chua_vat numeric not null default 0,
  vat integer not null default 10 check (vat in (0,5,8,10)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_dm_thue_cap1 on public.dm_thue(cap1);
create index if not exists idx_dm_thue_cap2 on public.dm_thue(cap2) where cap2 <> '';

-- DM thuc
create table if not exists public.dm_thuc (
  ma_thuc text primary key,
  ten_thuc text not null default '',
  cap1 text not null default '',
  cap2 text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_dm_thuc_cap1 on public.dm_thuc(cap1);
create index if not exists idx_dm_thuc_cap2 on public.dm_thuc(cap2) where cap2 <> '';

-- Ton thue theo ngay import (1 dong / ma / ngay)
create table if not exists public.ton_thue_ngay (
  ngay date not null,
  ma_thue text not null references public.dm_thue(ma_thue) on delete cascade,
  sl_ton numeric not null default 0,
  gia_chua_vat numeric not null default 0,
  vat integer not null default 10,
  primary key (ngay, ma_thue)
);
create index if not exists idx_ton_thue_ngay_ngay on public.ton_thue_ngay(ngay desc);

-- Ton thuc theo ngay
create table if not exists public.ton_thuc_ngay (
  ngay date not null,
  ma_thuc text not null references public.dm_thuc(ma_thuc) on delete cascade,
  sl_kha_dung numeric not null default 0,
  primary key (ngay, ma_thuc)
);
create index if not exists idx_ton_thuc_ngay_ngay on public.ton_thuc_ngay(ngay desc);

-- Hoa don da Luu & Xuat (tru tam trong ngay, hom sau import ghi de)
create table if not exists public.hoa_don_xuat (
  id uuid primary key default gen_random_uuid(),
  ngay date not null default current_date,
  khach_ma text,
  khach_ten text,
  tu_ngay date,
  den_ngay date,
  tong_vat numeric not null default 0,
  dong jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_hoa_don_ngay on public.hoa_don_xuat(ngay desc, created_at desc);

-- RLS
alter table public.dm_thue enable row level security;
alter table public.dm_thuc enable row level security;
alter table public.ton_thue_ngay enable row level security;
alter table public.ton_thuc_ngay enable row level security;
alter table public.hoa_don_xuat enable row level security;

-- DM: tat ca authenticated doc; chi nguoi co quan_ly_cai_dat hoac ke_toan moi ghi
drop policy if exists dm_thue_read on public.dm_thue;
create policy dm_thue_read on public.dm_thue for select to authenticated using (true);
drop policy if exists dm_thue_write on public.dm_thue;
create policy dm_thue_write on public.dm_thue for all to authenticated
  using (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'))
  with check (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'));

drop policy if exists dm_thuc_read on public.dm_thuc;
create policy dm_thuc_read on public.dm_thuc for select to authenticated using (true);
drop policy if exists dm_thuc_write on public.dm_thuc;
create policy dm_thuc_write on public.dm_thuc for all to authenticated
  using (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'))
  with check (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'));

drop policy if exists ton_thue_read on public.ton_thue_ngay;
create policy ton_thue_read on public.ton_thue_ngay for select to authenticated using (true);
drop policy if exists ton_thue_write on public.ton_thue_ngay;
create policy ton_thue_write on public.ton_thue_ngay for all to authenticated
  using (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'))
  with check (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'));

drop policy if exists ton_thuc_read on public.ton_thuc_ngay;
create policy ton_thuc_read on public.ton_thuc_ngay for select to authenticated using (true);
drop policy if exists ton_thuc_write on public.ton_thuc_ngay;
create policy ton_thuc_write on public.ton_thuc_ngay for all to authenticated
  using (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'))
  with check (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'));

drop policy if exists hoa_don_read on public.hoa_don_xuat;
create policy hoa_don_read on public.hoa_don_xuat for select to authenticated using (true);
drop policy if exists hoa_don_write on public.hoa_don_xuat;
create policy hoa_don_write on public.hoa_don_xuat for all to authenticated
  using (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'))
  with check (public.has_permission('quan_ly_cai_dat') or public.has_permission('ke_toan') or public.has_permission('xem_tai_chinh'));

-- Helper: so ton 4 cot (gom theo Cap1/Cap2), co tru tam trong ngay hien tai
create or replace function public.fn_so_ton_4cot(p_ngay date default current_date)
returns table(cap1 text, cap2 text, ten_thue text, ton_thue1 numeric, ton_thuc1 numeric, ton_thue2 numeric, ton_thuc2 numeric, thua numeric)
language sql stable security definer set search_path = public as $$
  with thue_agg1 as (
    select d.cap1, sum(t.sl_ton) as sl from dm_thue d join ton_thue_ngay t on t.ma_thue=d.ma_thue where t.ngay=p_ngay group by d.cap1
  ),
  thuc_agg1 as (
    select d.cap1, sum(t.sl_kha_dung) as sl from dm_thuc d join ton_thuc_ngay t on t.ma_thuc=d.ma_thuc where t.ngay=p_ngay group by d.cap1
  ),
  thue_agg2 as (
    select d.cap2, sum(t.sl_ton) as sl from dm_thue d join ton_thue_ngay t on t.ma_thue=d.ma_thue where t.ngay=p_ngay and d.cap2<>'' group by d.cap2
  ),
  thuc_agg2 as (
    select d.cap2, sum(t.sl_kha_dung) as sl from dm_thuc d join ton_thuc_ngay t on t.ma_thuc=d.ma_thuc where t.ngay=p_ngay and d.cap2<>'' group by d.cap2
  ),
  caps as (
    select distinct cap1, cap2, min(ten_thue) as ten from dm_thue where cap1<>'' group by cap1, cap2
  )
  select c.cap1, c.cap2, c.ten,
    coalesce(t1.sl,0) as ton_thue1,
    coalesce(r1.sl,0) as ton_thuc1,
    case when c.cap2<>'' then coalesce(t2.sl,0) else null end as ton_thue2,
    case when c.cap2<>'' then coalesce(r2.sl,0) else null end as ton_thuc2,
    coalesce(t1.sl,0)-coalesce(r1.sl,0) as thua
  from caps c
  left join thue_agg1 t1 on t1.cap1=c.cap1
  left join thuc_agg1 r1 on r1.cap1=c.cap1
  left join thue_agg2 t2 on t2.cap2=c.cap2
  left join thuc_agg2 r2 on r2.cap2=c.cap2
  order by c.cap1;
$$;
grant execute on function public.fn_so_ton_4cot(date) to authenticated, service_role;
