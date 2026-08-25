insert into public.categories (slug, name) values ('nhom_van_de_kho','Nhóm vấn đề kho') on conflict (slug) do nothing;
-- seed 6 mục (lấy id category rồi insert)
do $$ declare v uuid; begin select id into v from public.categories where slug='nhom_van_de_kho';
insert into public.category_items (category_id, name, sort_order) values
 (v,'Thiếu vỏ hộp',1),(v,'Hộp xấu',2),(v,'Thiếu linh kiện',3),(v,'Hàng lâu ngày',4),(v,'Hàng trả lại',5),(v,'Hàng đề xuất thanh lý',6)
on conflict (category_id, name) do nothing; end $$;
