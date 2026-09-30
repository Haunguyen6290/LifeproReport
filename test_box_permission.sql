-- Test migration 0066 - chạy trong Supabase SQL Editor
-- Kiểm tra quyền xem_box đã có chưa

SELECT name, permissions
FROM public.roles
WHERE name IN ('Admin', 'Giám đốc', 'Kinh doanh');

-- Nếu chưa có 'xem_box' trong permissions, migration chưa chạy
-- Cần chạy migration 0066_boxes.sql
