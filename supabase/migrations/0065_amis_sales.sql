-- Bảng lưu dữ liệu AMIS bán hàng (59 cột từ file Excel)
create table if not exists public.amis_sales_rows (
  id bigint primary key generated always as identity,

  -- Metadata
  so_ct text not null,
  ma_kh text,
  ma_hang text not null,
  ngay_hach_toan date,
  trang_thai text, -- 'chuan' | 'khong_chuan'

  -- Thông tin chung (25 cột đầu)
  hinh_thuc_ban_hang text,
  phuong_thuc_thanh_toan text,
  kiem_phieu_xuat_kho text,
  lap_kem_hoa_don text,
  da_lap_hoa_don text,
  ngay_chung_tu date,
  so_phieu_xuat text,
  mau_so_hd text,
  ky_hieu_hd text,
  so_hoa_don text,
  ngay_hoa_don date,
  ten_khach_hang text,
  dia_chi text,
  ma_so_thue text,
  don_vi_giao_dai_ly text,
  nguoi_nop text,
  nop_vao_tk text,
  ten_ngan_hang text,
  dien_giai text,
  ly_do_xuat text,
  loai_tien text,
  ty_gia numeric(18,4),

  -- Chi tiết hàng tiền (cột 25-52)
  ten_hang text,
  la_dong_ghi_chu text,
  hang_khuyen_mai text,
  chiet_khau_thuong_mai text,
  tk_tien_chi_phi_no text,
  tk_doanh_thu_co text,
  dvt text,
  so_luong numeric(18,4),
  don_gia numeric(18,2),
  thanh_tien numeric(18,2),
  thanh_tien_quy_doi numeric(18,2),
  thanh_tien_quy_doi_tghq numeric(18,2),
  ty_le_ck numeric(18,4),
  tien_chiet_khau numeric(18,2),
  tien_ck_quy_doi numeric(18,2),
  tien_ck_quy_doi_tghq numeric(18,2),
  tk_chiet_khau text,
  gia_tinh_thue_xk numeric(18,2),
  phan_tram_thue_xk numeric(18,4),
  tien_thue_xk numeric(18,2),
  tk_thue_xk text,
  phan_tram_thue_gtgt numeric(18,4),
  phan_tram_thue_suat_khac numeric(18,4),
  tien_thue_gtgt numeric(18,2),
  tien_thue_gtgt_quy_doi numeric(18,2),
  tk_thue_gtgt text,
  hh_khong_th_tren_to_khai text,

  -- Chi tiết giá vốn (cột 53-58)
  ma_kho text,
  tk_gia_von text,
  tk_kho text,
  don_gia_von numeric(18,2),
  tien_von numeric(18,2),
  hang_hoa_giu_ho_ban_ho text,

  -- Audit
  imported_by uuid references auth.users(id),
  imported_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index cho performance
create index if not exists idx_amis_so_ct on public.amis_sales_rows(so_ct);
create index if not exists idx_amis_ma_kh on public.amis_sales_rows(ma_kh);
create index if not exists idx_amis_ma_hang on public.amis_sales_rows(ma_hang);
create index if not exists idx_amis_ngay on public.amis_sales_rows(ngay_hach_toan);
create index if not exists idx_amis_imported_at on public.amis_sales_rows(imported_at);

-- Bảng log import/export AMIS
create table if not exists public.amis_logs (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null,
  action text not null, -- 'import' | 'export'
  file_name text,
  so_dong int,
  so_ct_tu text,
  so_ct_den text,
  filters jsonb, -- {ma_kh, tu, den}
  created_at timestamptz default now()
);

create index if not exists idx_amis_logs_user on public.amis_logs(user_id, created_at desc);
create index if not exists idx_amis_logs_created on public.amis_logs(created_at desc);

-- RLS
alter table public.amis_sales_rows enable row level security;
alter table public.amis_logs enable row level security;

create policy "Allow read for auth users" on public.amis_sales_rows for select using (auth.role() = 'authenticated');
create policy "Allow all for service role" on public.amis_sales_rows for all using (auth.role() = 'service_role');

create policy "Allow read own logs" on public.amis_logs for select using (auth.uid() = user_id or auth.role() = 'service_role');
create policy "Allow insert own logs" on public.amis_logs for insert with check (auth.uid() = user_id or auth.role() = 'service_role');
