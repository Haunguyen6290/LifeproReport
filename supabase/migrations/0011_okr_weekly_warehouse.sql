-- Depends on 0001_init.sql: public.roles, public.has_permission(), public.touch_updated_at()
-- OKR
create table public.okrs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  tu_ngay date not null, den_ngay date not null,
  loai_ky_goi_y text not null default '' check (loai_ky_goi_y in ('','Tháng','Quý','6 tháng','Năm')),
  objective text not null,
  is_company boolean not null default false,
  parent_kr_id uuid,
  trang_thai text not null default 'Mới' check (trang_thai in ('Mới','Đang làm','Hoàn thành','Chưa đạt')),
  tien_do int not null default 0 check (tien_do between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tu_ngay <= den_ngay)
);
create table public.okr_key_results (
  id uuid primary key default gen_random_uuid(),
  okr_id uuid not null references public.okrs(id) on delete cascade,
  noi_dung text not null,
  sort_order int not null default 0
);
alter table public.okrs add constraint okrs_parent_kr_id_fkey foreign key (parent_kr_id) references public.okr_key_results(id) on delete set null;
create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  tuan_tu date not null, tuan_den date not null,
  noi_dung text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tuan_tu)
);
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  tuan_tu date not null, tuan_den date not null,
  noi_dung text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tuan_tu)
);
create table public.warehouse_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  ngay date not null default current_date,
  product_group_id uuid references public.category_items(id) on delete set null,
  nhom_van_de_id uuid references public.category_items(id) on delete set null,
  so_luong numeric,
  thuc_trang text not null default '',
  de_xuat text not null default '',
  trang_thai text not null default 'Chờ giải quyết' check (trang_thai in ('Chờ giải quyết','Đang giải quyết','Đã xử lý')),
  y_kien_quan_ly text not null default '',
  tuan_tu date, tuan_den date,
  created_at timestamptz not null default now()
);
-- updated_at triggers ("hiện sửa lúc")
create trigger trg_okrs_touch before update on public.okrs for each row execute function public.touch_updated_at();
create trigger trg_weekly_plans_touch before update on public.weekly_plans for each row execute function public.touch_updated_at();
create trigger trg_weekly_reports_touch before update on public.weekly_reports for each row execute function public.touch_updated_at();
-- RLS
alter table public.okrs enable row level security;
alter table public.okr_key_results enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.warehouse_reports enable row level security;
create policy okrs_all on public.okrs for select to authenticated using (true);
create policy okrs_ins on public.okrs for insert to authenticated with check (user_id = auth.uid() or is_company = true and exists (select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=auth.uid() and r.permissions ? 'quan_ly_okr'));
create policy okrs_upd on public.okrs for update to authenticated using (user_id = auth.uid() or public.has_permission('quan_ly_okr'));
create policy okrs_del on public.okrs for delete to authenticated using (user_id = auth.uid() or public.has_permission('quan_ly_okr'));
create policy okrkr_read on public.okr_key_results for select to authenticated using (true);
create policy okrkr_write on public.okr_key_results for all to authenticated using (exists (select 1 from public.okrs o where o.id = okr_id and (o.user_id = auth.uid() or public.has_permission('quan_ly_okr')))) with check (exists (select 1 from public.okrs o where o.id = okr_id and (o.user_id = auth.uid() or public.has_permission('quan_ly_okr'))));
create policy wp_read on public.weekly_plans for select to authenticated using (true);
create policy wp_write on public.weekly_plans for all to authenticated using (user_id = auth.uid() or public.has_permission('quan_ly_okr')) with check (user_id = auth.uid() or public.has_permission('quan_ly_okr'));
create policy wr_read on public.weekly_reports for select to authenticated using (true);
create policy wr_write on public.weekly_reports for all to authenticated using (user_id = auth.uid() or public.has_permission('quan_ly_okr')) with check (user_id = auth.uid() or public.has_permission('quan_ly_okr'));
create policy wh_read on public.warehouse_reports for select to authenticated using (true);
create policy wh_write on public.warehouse_reports for all to authenticated using (user_id = auth.uid() or public.has_permission('quan_ly_okr'));
create index idx_okrs_user_period on public.okrs (user_id, tu_ngay, den_ngay);
create index idx_okrkr_okr on public.okr_key_results (okr_id, sort_order);
create index idx_weekly_user on public.weekly_plans (user_id, tuan_tu);
create index idx_wh_week on public.warehouse_reports (tuan_tu, product_group_id);
