-- 0047_warehouse_items_jsonb.sql
-- Thêm cột items JSONB cho bảng warehouse_reports để lưu nhiều dòng sản phẩm.
-- Mỗi phần tử: {product_group_id, so_luong, don_vi, tinh_trang}
-- Giữ lại product_group_id + so_luong cũ cho tương thích; items = null khi chưa nhập kiểu mới.

alter table public.warehouse_reports add column if not exists items jsonb;
comment on column public.warehouse_reports.items is 'Mảng [{product_group_id, so_luong, don_vi, tinh_trang}] — nhiều dòng sản phẩm cho 1 báo cáo';
