-- 0007_tinh_thanh.sql — Danh mục 63 tỉnh/thành phố (trước sáp nhập) + chuẩn hóa dữ liệu cũ
insert into public.categories (slug, name) values ('tinh_thanh', 'Tỉnh/Thành phố') on conflict (slug) do nothing;

do $$
declare v_cat uuid;
begin
  select id into v_cat from public.categories where slug='tinh_thanh';
  insert into public.category_items (category_id, name, sort_order) values
   (v_cat,'An Giang',1),(v_cat,'Bà Rịa - Vũng Tàu',2),(v_cat,'Bắc Giang',3),(v_cat,'Bắc Kạn',4),(v_cat,'Bạc Liêu',5),
   (v_cat,'Bắc Ninh',6),(v_cat,'Bến Tre',7),(v_cat,'Bình Dương',8),(v_cat,'Bình Định',9),(v_cat,'Bình Phước',10),
   (v_cat,'Bình Thuận',11),(v_cat,'Cà Mau',12),(v_cat,'Cao Bằng',13),(v_cat,'Cần Thơ',14),(v_cat,'Đà Nẵng',15),
   (v_cat,'Đắk Lắk',16),(v_cat,'Đắk Nông',17),(v_cat,'Điện Biên',18),(v_cat,'Đồng Nai',19),(v_cat,'Đồng Tháp',20),
   (v_cat,'Gia Lai',21),(v_cat,'Hà Giang',22),(v_cat,'Hà Nam',23),(v_cat,'Hà Nội',24),(v_cat,'Hà Tĩnh',25),
   (v_cat,'Hải Dương',26),(v_cat,'Hải Phòng',27),(v_cat,'Hậu Giang',28),(v_cat,'Hòa Bình',29),(v_cat,'Hồ Chí Minh',30),
   (v_cat,'Hưng Yên',31),(v_cat,'Khánh Hòa',32),(v_cat,'Kiên Giang',33),(v_cat,'Kon Tum',34),(v_cat,'Lai Châu',35),
   (v_cat,'Lâm Đồng',36),(v_cat,'Lạng Sơn',37),(v_cat,'Lào Cai',38),(v_cat,'Long An',39),(v_cat,'Nam Định',40),
   (v_cat,'Nghệ An',41),(v_cat,'Ninh Bình',42),(v_cat,'Ninh Thuận',43),(v_cat,'Phú Thọ',44),(v_cat,'Phú Yên',45),
   (v_cat,'Quảng Bình',46),(v_cat,'Quảng Nam',47),(v_cat,'Quảng Ngãi',48),(v_cat,'Quảng Ninh',49),(v_cat,'Quảng Trị',50),
   (v_cat,'Sóc Trăng',51),(v_cat,'Sơn La',52),(v_cat,'Tây Ninh',53),(v_cat,'Thái Bình',54),(v_cat,'Thái Nguyên',55),
   (v_cat,'Thanh Hóa',56),(v_cat,'Thừa Thiên Huế',57),(v_cat,'Tiền Giang',58),(v_cat,'Trà Vinh',59),(v_cat,'Tuyên Quang',60),
   (v_cat,'Vĩnh Long',61),(v_cat,'Vĩnh Phúc',62),(v_cat,'Yên Bái',63)
  on conflict (category_id, name) do nothing;

  -- Chuẩn hóa dữ liệu cũ: bỏ tiền tố "Tỉnh / Thành phố / Thủ đô / TP" để khớp tên chuẩn
  update public.customers
  set tinh_thanh = trim(regexp_replace(tinh_thanh, '^(Tỉnh|Thành phố|Thủ đô|TP\.?)\s+', ''))
  where tinh_thanh ~ '^(Tỉnh|Thành phố|Thủ đô|TP\.?)\s+';
end $$;
