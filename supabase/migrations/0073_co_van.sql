-- 0073_co_van.sql — Cố vấn Giám đốc: chấm Kế hoạch/Báo cáo tuần + lưu hội thoại
-- Chỉ thêm bảng mới, không sửa bảng cũ.

-- ---------- 1) Bảng đánh giá từng bài ----------
create table if not exists public.co_van_danh_gia (
  id uuid primary key default gen_random_uuid(),
  loai text not null check (loai in ('ke_hoach','bao_cao')),
  target_id uuid not null,
  user_id uuid not null references public.profiles(id),
  tuan_tu date not null,
  tuan_den date not null,
  ket_qua text not null check (ket_qua in ('Dat','Can sua','Khong dat')),
  ly_do text not null default '',
  dau_hieu_doi_pho text not null default '',
  gop_y_soan_san text not null default '',
  trang_thai text not null default 'Cho duyet' check (trang_thai in ('Cho duyet','Da gui','Bo qua','Tu gui')),
  phien_ban_luc timestamptz not null,
  created_at timestamptz not null default now(),
  gui_luc timestamptz,
  gui_boi uuid references public.profiles(id),
  unique (loai, target_id)
);
create index if not exists idx_cvdg_trangthai on public.co_van_danh_gia (trang_thai, tuan_tu desc);
create index if not exists idx_cvdg_user on public.co_van_danh_gia (user_id, tuan_tu desc);
create index if not exists idx_cvdg_tuan on public.co_van_danh_gia (tuan_tu desc);

-- ---------- 2) Bảng hội thoại Cố vấn (web + Telegram chung luồng) ----------
create table if not exists public.co_van_tin_nhan (
  id uuid primary key default gen_random_uuid(),
  vai_tro text not null check (vai_tro in ('user','assistant','system')),
  noi_dung text not null,
  kenh text not null default 'web' check (kenh in ('web','telegram')),
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_cvtm_time on public.co_van_tin_nhan (created_at desc);

-- ---------- 3) RLS — chỉ quan_ly_cai_dat mới đọc/ghi ----------
alter table public.co_van_danh_gia enable row level security;
alter table public.co_van_tin_nhan enable row level security;

drop policy if exists cvdg_read on public.co_van_danh_gia;
create policy cvdg_read on public.co_van_danh_gia
  for select to authenticated using (public.has_permission('quan_ly_cai_dat'));

drop policy if exists cvdg_write on public.co_van_danh_gia;
create policy cvdg_write on public.co_van_danh_gia
  for all to authenticated
  using (public.has_permission('quan_ly_cai_dat'))
  with check (public.has_permission('quan_ly_cai_dat'));

drop policy if exists cvtm_read on public.co_van_tin_nhan;
create policy cvtm_read on public.co_van_tin_nhan
  for select to authenticated using (public.has_permission('quan_ly_cai_dat'));

drop policy if exists cvtm_write on public.co_van_tin_nhan;
create policy cvtm_write on public.co_van_tin_nhan
  for all to authenticated
  using (public.has_permission('quan_ly_cai_dat'))
  with check (public.has_permission('quan_ly_cai_dat'));
