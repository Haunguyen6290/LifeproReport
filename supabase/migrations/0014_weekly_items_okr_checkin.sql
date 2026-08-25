-- 0014_weekly_items_okr_checkin.sql
-- Đợt 2 (24/08): Kế hoạch/Báo cáo tuần theo TỪNG DÒNG công việc + Check-in OKR hàng tuần
-- + phần Duyệt/Xác nhận/Góp ý của quản lý dưới card
-- Depends on: 0001_init.sql (profiles, has_permission, touch_updated_at), 0011 (weekly_plans, weekly_reports, okrs)

-- ---------- 1) Bổ sung cột phần "tổng quan tuần" cho bảng cha ----------
alter table public.weekly_plans   add column if not exists muc_tieu_tuan text not null default '';
alter table public.weekly_reports add column if not exists tu_danh_gia text not null default '';
alter table public.weekly_reports add column if not exists ty_le_ht int;
alter table public.weekly_reports add column if not exists diem_noi_bat text not null default '';
alter table public.weekly_reports add column if not exists kho_khan text not null default '';
alter table public.weekly_reports add column if not exists de_xuat text not null default '';

-- Duyệt / Xác nhận / Góp ý của quản lý (hiện dưới card)
alter table public.weekly_plans   add column if not exists trang_thai_duyet text not null default 'Chờ duyệt';
alter table public.weekly_plans   add column if not exists y_kien_quan_ly text not null default '';
alter table public.weekly_plans   add column if not exists duyet_boi uuid references public.profiles(id);
alter table public.weekly_plans   add column if not exists duyet_luc timestamptz;
alter table public.weekly_reports add column if not exists trang_thai_duyet text not null default 'Chờ duyệt';
alter table public.weekly_reports add column if not exists y_kien_quan_ly text not null default '';
alter table public.weekly_reports add column if not exists duyet_boi uuid references public.profiles(id);
alter table public.weekly_reports add column if not exists duyet_luc timestamptz;

-- ---------- 2) Dòng công việc của Kế hoạch tuần ----------
create table if not exists public.weekly_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  cong_viec text not null,
  kq_can_dat text not null default '',
  ngay_list text not null default '',   -- 'T2,T4,T6' — ngày dự kiến làm
  uu_tien text not null default 'Trung bình' check (uu_tien in ('Cao','Trung bình','Thấp')),
  kr_id uuid references public.okr_key_results(id) on delete set null,
  sort_order int not null default 0
);

-- ---------- 3) Dòng kết quả của Báo cáo tuần (khóa vào dòng kế hoạch) ----------
create table if not exists public.weekly_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  plan_item_id uuid references public.weekly_plan_items(id) on delete set null,
  viec_da_lam text not null default '',
  phan_tram int check (phan_tram between 0 and 100),
  tu_danh_gia text not null default 'Chưa xong' check (tu_danh_gia in ('Hoàn thành','Hoàn thành một phần','Chưa xong')),
  nguyen_nhan text not null default '',
  sort_order int not null default 0
);

-- ---------- 4) Check-in OKR hàng tuần ----------
create table if not exists public.okr_check_ins (
  id uuid primary key default gen_random_uuid(),
  okr_id uuid not null references public.okrs(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  tuan_tu date not null,
  tien_do int not null default 0 check (tien_do between 0 and 100),
  tu_tin text not null default 'Ổn' check (tu_tin in ('Tốt','Ổn','Không ổn')),
  vuong_mac text not null default '',
  can_ho_tro text not null default '',
  y_kien_quan_ly text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (okr_id, tuan_tu)
);

-- ---------- 5) Trigger updated_at ----------
drop trigger if exists trg_okr_check_ins_touch on public.okr_check_ins;
create trigger trg_okr_check_ins_touch before update on public.okr_check_ins
  for each row execute function public.touch_updated_at();

-- ---------- 6) RLS ----------
alter table public.weekly_plan_items   enable row level security;
alter table public.weekly_report_items enable row level security;
alter table public.okr_check_ins       enable row level security;

-- Đọc: minh bạch toàn công ty (giống weekly_plans/reports/okrs)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weekly_plan_items' and policyname='wpi_read') then
    create policy wpi_read on public.weekly_plan_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weekly_report_items' and policyname='wri_read') then
    create policy wri_read on public.weekly_report_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='okr_check_ins' and policyname='oci_read') then
    create policy oci_read on public.okr_check_ins for select to authenticated using (true);
  end if;
end $$;

-- Ghi: chỉ chủ sở hữu bảng cha (hoặc quản lý OKR)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weekly_plan_items' and policyname='wpi_write') then
    create policy wpi_write on public.weekly_plan_items for all to authenticated
      using (exists (select 1 from public.weekly_plans p where p.id = plan_id and (p.user_id = auth.uid() or public.has_permission('quan_ly_okr'))))
      with check (exists (select 1 from public.weekly_plans p where p.id = plan_id and (p.user_id = auth.uid() or public.has_permission('quan_ly_okr'))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='weekly_report_items' and policyname='wri_write') then
    create policy wri_write on public.weekly_report_items for all to authenticated
      using (exists (select 1 from public.weekly_reports r where r.id = report_id and (r.user_id = auth.uid() or public.has_permission('quan_ly_okr'))))
      with check (exists (select 1 from public.weekly_reports r where r.id = report_id and (r.user_id = auth.uid() or public.has_permission('quan_ly_okr'))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='okr_check_ins' and policyname='oci_write') then
    create policy oci_write on public.okr_check_ins for all to authenticated
      using (user_id = auth.uid() or public.has_permission('quan_ly_okr'))
      with check (user_id = auth.uid() or public.has_permission('quan_ly_okr'));
  end if;
end $$;

-- ---------- 7) Index ----------
create index if not exists idx_wpi_plan   on public.weekly_plan_items (plan_id, sort_order);
create index if not exists idx_wri_report on public.weekly_report_items (report_id, sort_order);
create index if not exists idx_wri_planit on public.weekly_report_items (plan_item_id);
create index if not exists idx_oci_okr    on public.okr_check_ins (okr_id, tuan_tu desc);
create index if not exists idx_oci_week   on public.okr_check_ins (tuan_tu, user_id);
