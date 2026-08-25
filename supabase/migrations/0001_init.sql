-- =============================================================
-- 0001_init.sql — CRM Khách hàng · Thị trường · Chiến dịch
-- Spec: docs/du-lieu/mo-hinh.md · docs/nghiep-vu/*
-- =============================================================
create extension if not exists pgcrypto;

-- ---------- ROLES ----------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  permissions jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  full_name text not null unique,
  role_id uuid not null references public.roles(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','LOCKED')),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.permissions ? perm
  );
$$;

-- ---------- CATEGORIES ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default ''
);
create table public.category_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  code text not null default '',
  name text not null,
  description text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  unique (category_id, name)
);

-- ---------- CUSTOMERS ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  ma_kh text not null unique,
  ten_kh text not null,
  assigned_to uuid not null references public.profiles(id),
  sdt text not null default '',
  facebook text not null default '',
  google_maps text not null default '',
  dia_chi text not null default '',
  quan_huyen text not null default '',
  tinh_thanh text not null default '',
  province_id uuid,
  district_id uuid,
  nguoi_quyet_dinh text not null default '',
  chuc_vu text not null default '',
  business_model text not null default '',
  tier_id uuid references public.category_items(id),
  status_id uuid references public.category_items(id),
  scale_id uuid references public.category_items(id),
  so_co_so int,
  xe_ngay numeric,
  segment text not null default '',
  sp_dang_ban text not null default '',
  nguon_nhap text not null default '',
  sp_ban_manh text not null default '',
  sp_ban_yeu text not null default '',
  van_de text not null default '',
  sp_cty_phu_hop text not null default '',
  ly_do_chon text not null default '',
  tro_ngai text not null default '',
  ghi_chu text not null default '',
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- ---------- MARKET NEWS ----------
create table public.market_news (
  id uuid primary key default gen_random_uuid(),
  ngay date not null default current_date,
  reporter_id uuid not null references public.profiles(id),
  type_id uuid references public.category_items(id),
  content text not null,
  source text not null default '',
  product_id uuid references public.category_items(id),
  importance_id uuid references public.category_items(id),
  suggested_action text not null default '',
  status text not null default 'MOI' check (status in ('MOI','THAOLUAN','KETLUAN')),
  conclusion_content text not null default '',
  conclusion_resolved boolean,
  conclusion_by uuid references public.profiles(id),
  conclusion_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- CAMPAIGNS + OKR ----------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type_id uuid references public.category_items(id),
  start_date date,
  end_date date,
  objective text not null default '',
  status_id uuid references public.category_items(id),
  owner_id uuid not null references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.key_results (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);
create table public.campaign_updates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ngay date not null default current_date,
  reporter_id uuid not null references public.profiles(id),
  type_id uuid references public.category_items(id),
  content text not null,
  rating text check (rating in ('TOT','BINH_THUONG','XAU')),
  conclusion_content text not null default '',
  conclusion_resolved boolean,
  conclusion_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- SHARED ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('news','campaign_update')),
  target_id uuid not null,
  author_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create table public.object_links (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('news','campaign_update')),
  owner_id uuid not null,
  target_type text not null check (target_type in ('customer','product')),
  target_id uuid not null,
  unique (owner_type, owner_id, target_type, target_id)
);
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('news','campaign_update','comment')),
  owner_id uuid not null,
  storage_path text not null,
  public_url text not null,
  uploader_id uuid not null references public.profiles(id),
  byte_size int,
  mime text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);
create table public.settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null default '',
  added int not null default 0,
  dupes int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  pending jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- TRIGGER updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger trg_campaigns_touch before update on public.campaigns for each row execute function public.touch_updated_at();
create trigger trg_campaign_updates_touch before update on public.campaign_updates for each row execute function public.touch_updated_at();
create trigger trg_settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- ---------- INDEXES ----------
create index idx_customers_assigned on public.customers (assigned_to);
create index idx_customers_tier on public.customers (tier_id);
create index idx_audit_entity on public.audit_logs (entity_type, entity_id, created_at desc);
create index idx_audit_actor on public.audit_logs (actor_id, created_at desc);
create index idx_audit_time on public.audit_logs (created_at desc);
create index idx_comments_target on public.comments (target_type, target_id);
create index idx_links_owner on public.object_links (owner_type, owner_id);
create index idx_attach_owner on public.attachments (owner_type, owner_id);
create index idx_news_time on public.market_news (created_at desc);
create index idx_cupd_campaign on public.campaign_updates (campaign_id, created_at desc);
create index idx_kr_campaign on public.key_results (campaign_id, sort_order);
create index idx_catitems_cat on public.category_items (category_id, sort_order);

-- ---------- RLS ----------
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.category_items enable row level security;
alter table public.customers enable row level security;
alter table public.market_news enable row level security;
alter table public.campaigns enable row level security;
alter table public.key_results enable row level security;
alter table public.campaign_updates enable row level security;
alter table public.comments enable row level security;
alter table public.object_links enable row level security;
alter table public.attachments enable row level security;
alter table public.settings enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_logs enable row level security;

-- roles
create policy roles_read on public.roles for select to authenticated using (true);
create policy roles_write on public.roles for all to authenticated
  using (public.has_permission('quan_ly_nguoi_dung'))
  with check (public.has_permission('quan_ly_nguoi_dung'));

-- profiles
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission('quan_ly_nguoi_dung'))
  with check (id = auth.uid() or public.has_permission('quan_ly_nguoi_dung'));

-- categories / items
create policy cat_read on public.categories for select to authenticated using (true);
create policy cat_write on public.categories for all to authenticated
  using (public.has_permission('quan_ly_danh_muc')) with check (public.has_permission('quan_ly_danh_muc'));
create policy cati_read on public.category_items for select to authenticated using (true);
create policy cati_write on public.category_items for all to authenticated
  using (public.has_permission('quan_ly_danh_muc')) with check (public.has_permission('quan_ly_danh_muc'));

-- customers
create policy cust_read on public.customers for select to authenticated using (true);
create policy cust_insert on public.customers for insert to authenticated
  with check (assigned_to = auth.uid() or public.has_permission('sua_khach_bat_ky'));
create policy cust_update on public.customers for update to authenticated
  using (assigned_to = auth.uid() or public.has_permission('sua_khach_bat_ky'));
create policy cust_delete on public.customers for delete to authenticated
  using (public.has_permission('xoa_khach'));

-- market news
create policy news_read on public.market_news for select to authenticated using (true);
create policy news_insert on public.market_news for insert to authenticated
  with check (reporter_id = auth.uid());
create policy news_update on public.market_news for update to authenticated
  using (public.has_permission('ket_luan'));

-- comments
create policy com_read on public.comments for select to authenticated using (true);
create policy com_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid());
create policy com_update on public.comments for update to authenticated
  using (author_id = auth.uid() or public.has_permission('ket_luan'));
create policy com_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.has_permission('ket_luan'));

-- campaigns
create policy camp_read on public.campaigns for select to authenticated using (true);
create policy camp_write on public.campaigns for all to authenticated
  using (public.has_permission('quan_ly_chien_dich')) with check (public.has_permission('quan_ly_chien_dich'));

-- key results
create policy kr_read on public.key_results for select to authenticated using (true);
create policy kr_write on public.key_results for all to authenticated
  using (public.has_permission('quan_ly_chien_dich')) with check (public.has_permission('quan_ly_chien_dich'));

-- campaign updates
create policy cupd_read on public.campaign_updates for select to authenticated using (true);
create policy cupd_insert on public.campaign_updates for insert to authenticated
  with check (reporter_id = auth.uid());
create policy cupd_update on public.campaign_updates for update to authenticated
  using (reporter_id = auth.uid() or public.has_permission('ket_luan'));

-- object links
create policy lnk_read on public.object_links for select to authenticated using (true);
create policy lnk_insert on public.object_links for insert to authenticated with check (true);
create policy lnk_delete on public.object_links for delete to authenticated using (
  public.has_permission('ket_luan')
  or exists (select 1 from public.market_news n where n.id = owner_id and owner_type = 'news' and n.reporter_id = auth.uid())
  or exists (select 1 from public.campaign_updates u where u.id = owner_id and owner_type = 'campaign_update' and u.reporter_id = auth.uid())
);

-- attachments
create policy att_read on public.attachments for select to authenticated using (true);
create policy att_insert on public.attachments for insert to authenticated with check (uploader_id = auth.uid());
create policy att_delete on public.attachments for delete to authenticated
  using (uploader_id = auth.uid() or public.has_permission('ket_luan'));

-- settings
create policy set_read on public.settings for select to authenticated using (true);
create policy set_write on public.settings for all to authenticated
  using (public.has_permission('quan_ly_cai_dat')) with check (public.has_permission('quan_ly_cai_dat'));

-- import batches
create policy imp_read on public.import_batches for select to authenticated
  using (public.has_permission('import_khach') or public.has_permission('xem_log'));
create policy imp_insert on public.import_batches for insert to authenticated
  with check (public.has_permission('import_khach') and actor_id = auth.uid());

-- audit logs
create policy log_read on public.audit_logs for select to authenticated using (true);
create policy log_insert on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());

-- ---------- SEED ----------
insert into public.roles (name, description, permissions, is_system) values
 ('ADMIN', 'Quản trị viên — toàn quyền',
  '["ket_luan","quan_ly_chien_dich","import_khach","xoa_khach","sua_khach_bat_ky","chuyen_khach_hang_loat","quan_ly_nguoi_dung","quan_ly_danh_muc","quan_ly_cai_dat","xem_log"]'::jsonb, true),
 ('SALES', 'Nhân viên kinh doanh', '[]'::jsonb, true)
on conflict (name) do nothing;

do $$
declare
  v_cat uuid;
begin
  insert into public.categories (slug, name) values ('mo_hinh_kd','Mô hình kinh doanh') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='mo_hinh_kd';
  insert into public.category_items (category_id, code, name, description, sort_order) values
   (v_cat,'','Nội thất ô tô','Cửa hàng chuyên nội thất: thảm, ghế, trần, vô lăng…',1),
   (v_cat,'','Gương đèn ô tô','Chuyên gương, đèn, bóng LED, bi gầm…',2),
   (v_cat,'','Cửa hàng','Bán lẻ phụ kiện tổng hợp',3),
   (v_cat,'','Đại lý phân phối','Nhập số lượng lớn, phân phối lại cho điểm bán',4),
   (v_cat,'','Gara sửa chữa','Gara tổng hợp, lắp phụ kiện kèm dịch vụ',5),
   (v_cat,'','Gara chuyên lốp','Chuyên lốp, mâm',6),
   (v_cat,'','Chăm sóc, rửa xe','Detailing, rửa xe, chăm sóc xe',7)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('phan_hang_kh','Phân hạng khách hàng') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='phan_hang_kh';
  insert into public.category_items (category_id, code, name, description, sort_order) values
   (v_cat,'A+','Khách hàng Chiến lược','Doanh số lớn, ảnh hưởng thị trường; cần CEO/chủ động chăm sóc.',1),
   (v_cat,'A','Khách hàng Thân thiết','Quan hệ tốt, mua ổn định, ủng hộ sản phẩm mới.',2),
   (v_cat,'B+','Khách hàng Tăng trưởng','Đang mua đều và tăng nhanh; mục tiêu nâng lên thân thiết.',3),
   (v_cat,'B','Khách hàng Cơ bản','Mua không đều, song song nhiều NCC, nhạy cảm giá.',4),
   (v_cat,'C','Khách hàng Tiềm năng','Chưa mua nhưng cơ hội cao, nhu cầu rõ.',5),
   (v_cat,'D','Khách hàng Rủi ro','Công nợ chậm, khiếu nại nhiều, lợi nhuận thấp.',6)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('trang_thai_kh','Trạng thái khách hàng') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='trang_thai_kh';
  insert into public.category_items (category_id, name, description, sort_order) values
   (v_cat,'Đang theo dõi','',1),
   (v_cat,'Ngừng theo dõi','Không xóa khách — chỉ chuyển sang trạng thái này',2)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('quy_mo','Quy mô') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='quy_mo';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'Nhỏ (<100tr/tháng)',1),(v_cat,'Trung (100–500tr/tháng)',2),(v_cat,'Lớn (>500tr/tháng)',3)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('phan_khuc_xe','Phân khúc xe') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='phan_khuc_xe';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'Xe dịch vụ',1),(v_cat,'Xe gia đình tầm trung',2),(v_cat,'Xe cao cấp',3),(v_cat,'Xe tải, bán tải',4)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('loai_tin_tt','Loại thông tin thị trường') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='loai_tin_tt';
  insert into public.category_items (category_id, name, description, sort_order) values
   (v_cat,'🛒 Khách hỏi mua','',1),(v_cat,'💬 Phản hồi sản phẩm','',2),(v_cat,'🏷️ Giá thị trường','',3),
   (v_cat,'🆚 Đối thủ làm gì','',4),(v_cat,'📦 Sản phẩm mới thị trường','',5),
   (v_cat,'❓ Nhu cầu chưa được đáp ứng','',6),(v_cat,'💡 Ý tưởng bán hàng','',7),
   (v_cat,'🔎 Khách hàng tiềm năng','Có thể tạo nhanh khách hàng hạng C từ tin loại này',8),
   (v_cat,'📊 Xu hướng thị trường','',9)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('san_pham','Sản phẩm') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='san_pham';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'Bóng LED L55',1),(v_cat,'Bóng LED LX360',2),(v_cat,'Bi gầm FX50',3),(v_cat,'TPMS',4),
   (v_cat,'Camera lùi',5),(v_cat,'Tất cả sản phẩm',6),(v_cat,'Khác',7)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('muc_do','Mức độ quan trọng') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='muc_do';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'🔴 Rất quan trọng — báo ngay',1),(v_cat,'🟠 Quan trọng — đưa vào họp tuần',2),(v_cat,'🟡 Tham khảo — lưu lại',3)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('loai_chien_dich','Loại chiến dịch') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='loai_chien_dich';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'Dự án mới',1),(v_cat,'Sản phẩm mới',2),(v_cat,'Khách hàng tiềm năng',3)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('loai_cap_nhat','Loại nội dung cập nhật') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='loai_cap_nhat';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'Đón nhận sản phẩm',1),(v_cat,'Phản hồi khách hàng',2),(v_cat,'Doanh số',3),
   (v_cat,'Vấn đề phát sinh',4),(v_cat,'Khác',5)
  on conflict (category_id, name) do nothing;

  insert into public.categories (slug, name) values ('trang_thai_chien_dich','Trạng thái chiến dịch') on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='trang_thai_chien_dich';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'Chuẩn bị',1),(v_cat,'Đang chạy',2),(v_cat,'Đã kết thúc',3)
  on conflict (category_id, name) do nothing;
end $$;

insert into public.settings (key, value) values
 ('TEN_DOANH_NGHIEP','PHỤ KIỆN Ô TÔ'),('TEN_RUT_GON','Phụ kiện ô tô'),
 ('TELEGRAM_BOT_TOKEN',''),('TELEGRAM_CHAT_ID',''),
 ('TB_KHACH_HANG_MOI','TRUE'),('TB_TIN_THI_TRUONG_MOI','TRUE'),('TB_COMMENT_MOI','TRUE'),
 ('TB_CAP_NHAT_CHIEN_DICH','TRUE'),('TB_CHIEN_DICH_MOI','TRUE'),('TB_KET_LUAN','TRUE'),('TB_IMPORT','TRUE'),
 ('TIMEZONE','Asia/Ho_Chi_Minh'),('DATE_FORMAT','yyyy-MM-dd')
on conflict (key) do nothing;
