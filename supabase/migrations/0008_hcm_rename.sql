-- 0008_hcm_rename.sql — Đổi "Hồ Chí Minh" thành "Thành phố Hồ Chí Minh" và chuẩn hóa dữ liệu
update public.category_items
set name = 'Thành phố Hồ Chí Minh'
where name in ('Hồ Chí Minh', 'TP Hồ Chí Minh', 'TPHCM', 'Sài Gòn');

-- Chuẩn hóa dữ liệu khách: mọi biến thể HCM -> Thành phố Hồ Chí Minh
update public.customers
set tinh_thanh = 'Thành phố Hồ Chí Minh'
where tinh_thanh in ('Hồ Chí Minh', 'TP Hồ Chí Minh', 'TPHCM', 'Sài Gòn', 'Thành phố Hồ Chí Minh');
