-- 0074_co_van_chien_dich_thi_truong.sql — mở rộng Cố vấn cho Chiến dịch & Tin thị trường
alter table public.co_van_danh_gia drop constraint if exists co_van_danh_gia_loai_check;
alter table public.co_van_danh_gia add constraint co_van_danh_gia_loai_check
  check (loai in ('ke_hoach','bao_cao','chien_dich','tin_thi_truong'));
