-- 0036_tro_ly_danh_muc.sql
-- Chuyển cấu hình trợ lý (vốn hard-code) vào Danh mục để ông tự sửa:
--   1. "tro_ly_phan_he" : mỗi mục = một phân hệ trợ lý.
--      extra.routes  = mảng tiền tố đường dẫn trang mà phân hệ xuất hiện (vd ["/bao-cao-tuan"]).
--      extra.mac_dinh= true  = hiện ở mọi trang chưa được cấu hình phân hệ nào.
--   2. "tro_ly_nhom"    : mỗi mục = một nhóm câu hỏi.
--      extra.phan_he = mảng tên phân hệ mà nhóm này thuộc về (một nhóm có thể thuộc nhiều phân hệ).
-- Widget và trang /tro-ly đọc từ 2 danh mục này; nếu chưa chạy migration vẫn chạy tạm như cũ.

do $$
declare
  v_cat uuid;
  v_exists boolean;
begin
  ---------- 1. PHÂN HỆ ----------
  insert into public.categories (slug, name, description)
  values ('tro_ly_phan_he', 'Phân hệ trợ lý', 'Mỗi mục là một phân hệ của bot. Sửa trường "Đường dẫn trang" để chọn phân hệ hiện ở trang nào.')
  on conflict (slug) do nothing;
  select id into v_cat from public.categories where slug='tro_ly_phan_he';

  select exists(select 1 from public.category_items where category_id=v_cat) into v_exists;
  if not v_exists then
    insert into public.category_items (category_id, code, name, description, sort_order, extra) values
      (v_cat, '', 'Bộ não chung công ty', 'Hiện ở mọi trang chưa cấu hình phân hệ riêng', 1, '{"routes":[],"mac_dinh":true}'::jsonb),
      (v_cat, '', 'Trợ lý OKRs', '', 2, '{"routes":["/okr"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Kế hoạch', 'Hiện cùng trang Báo cáo tuần', 3, '{"routes":["/bao-cao-tuan"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Báo cáo tuần', '', 4, '{"routes":["/bao-cao-tuan"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Check-in hàng tuần', '', 5, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Báo cáo vấn đề', '', 6, '{"routes":["/bao-cao-kho"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Khách hàng', '', 7, '{"routes":["/khach-hang"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Kinh doanh', '', 8, '{"routes":["/bao-cao-ban-hang"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Kho', '', 9, '{"routes":["/bao-cao-kho"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Tổng hợp kho', '', 10, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Bảo hành', '', 11, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Kế toán', '', 12, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Mua hàng', '', 13, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Marketing & Thiết kế', '', 14, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Phát triển sản phẩm', '', 15, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Lái xe', '', 16, '{"routes":[],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Chiến dịch', '', 17, '{"routes":["/chien-dich"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Thị trường kinh doanh', '', 18, '{"routes":["/thi-truong"],"mac_dinh":false}'::jsonb),
      (v_cat, '', 'Trợ lý Bảng tin', '', 19, '{"routes":[],"mac_dinh":false}'::jsonb)
    on conflict (category_id, name) do nothing;
  end if;

  ---------- 2. NHÓM ----------
  insert into public.categories (slug, name, description)
  values ('tro_ly_nhom', 'Nhóm trợ lý', 'Mỗi mục là một nhóm câu hỏi của bot. Sửa trường "Thuộc phân hệ" để gắn nhóm vào một hoặc nhiều phân hệ.')
  on conflict (slug) do nothing;
end $$;
