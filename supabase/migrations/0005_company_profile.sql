-- 0005_company_profile.sql — Hồ sơ công ty cho mẫu in ấn (tái dùng khi clone project)
create table if not exists public.company_profile (
  id int primary key default 1,
  ten_day_du text not null default '',
  ten_rut_gon text not null default '',
  dia_chi text not null default '',
  ma_so_thue text not null default '',
  dien_thoai text not null default '',
  email text not null default '',
  logo_url text not null default '',
  footer_in text not null default '',
  kho_giay text not null default 'A4',
  check (id = 1)
);
insert into public.company_profile (ten_day_du, ten_rut_gon) values ('', '') on conflict (id) do nothing;
alter table public.company_profile enable row level security;
create policy comp_read on public.company_profile for select to authenticated using (true);
create policy comp_write on public.company_profile for all to authenticated
  using (has_permission('quan_ly_cai_dat')) with check (has_permission('quan_ly_cai_dat'));
